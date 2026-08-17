import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';
import 'models.dart';

/// Persists the patient token across launches, with an in-memory cache.
class PatientTokenStore {
  static const _key = 'opd_patient_token';
  String? _token;

  String? get token => _token;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_key);
  }

  Future<void> set(String token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, token);
  }

  Future<void> clear() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

/// Readable, code-carrying error mirroring the backend §13 contract.
class ApiException implements Exception {
  final String code;
  final String message;
  final int statusCode;
  final dynamic details;
  ApiException(this.code, this.message, this.statusCode, [this.details]);

  @override
  String toString() => message;
}

class ApiClient {
  final String base = AppConfig.apiBaseUrl;
  final PatientTokenStore tokens = PatientTokenStore();

  Map<String, String> _authHeaders({bool json = true}) => {
        if (json) 'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (tokens.token != null) 'Authorization': 'Bearer ${tokens.token}',
      };

  /// Infer the image mime from the file extension so the backend's mime
  /// allowlist (jpeg/png/webp) accepts the multipart part.
  MediaType _imageMediaType(String path) {
    final ext = path.toLowerCase().split('.').last;
    return switch (ext) {
      'png' => MediaType('image', 'png'),
      'webp' => MediaType('image', 'webp'),
      _ => MediaType('image', 'jpeg'),
    };
  }

  Uri _uri(String path, [Map<String, dynamic>? query]) =>
      Uri.parse('$base$path').replace(
        queryParameters: query?.map((k, v) => MapEntry(k, '$v')),
      );

  /// Unwraps `{ success, data }` or throws a readable [ApiException].
  dynamic _decode(http.Response res) {
    dynamic body;
    try {
      body = jsonDecode(res.body);
    } catch (_) {
      throw ApiException('INVALID_RESPONSE', 'Unexpected server response.',
          res.statusCode);
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return (body is Map && body.containsKey('data')) ? body['data'] : body;
    }
    if (body is Map) {
      throw ApiException(
        (body['error'] ?? 'ERROR').toString(),
        (body['message'] ?? 'Something went wrong. Please try again.')
            .toString(),
        res.statusCode,
        body['details'],
      );
    }
    throw ApiException('ERROR', 'Something went wrong.', res.statusCode);
  }

  Future<T> _guard<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on SocketException {
      throw ApiException('NETWORK_ERROR',
          'Unable to reach the server. Check your connection.', 0);
    } on HttpException {
      throw ApiException('NETWORK_ERROR', 'Network error. Please try again.', 0);
    }
  }

  // ── Endpoints (public, no auth) ────────────────────────────
  Future<List<Doctor>> listDoctors() => _guard(() async {
        final res = await http.get(_uri('/public/doctors'));
        final data = _decode(res) as List;
        return data
            .map((d) => Doctor.fromJson(d as Map<String, dynamic>))
            .toList();
      });

  Future<Doctor> doctorBySlug(String slug) => _guard(() async {
        final res = await http.get(_uri('/public/doctors/$slug'));
        return Doctor.fromJson(_decode(res) as Map<String, dynamic>);
      });

  Future<DaySlots> slots(String doctorId, String date) => _guard(() async {
        final res =
            await http.get(_uri('/public/doctors/$doctorId/slots', {'date': date}));
        return DaySlots.fromJson(_decode(res) as Map<String, dynamic>);
      });

  Future<BookingResult> book({
    required String doctorId,
    required String date,
    required String startTime,
    required String patientName,
    required String patientMobile,
    String? patientAddress,
    String? description,
    required File screenshot,
  }) =>
      _guard(() async {
        final req = http.MultipartRequest(
          'POST',
          _uri('/public/appointments'),
        );
        req.fields.addAll({
          'doctor_id': doctorId,
          'appointment_date': date,
          'start_time': startTime,
          'patient_name': patientName,
          'patient_mobile': patientMobile,
          if (patientAddress != null && patientAddress.isNotEmpty)
            'patient_address': patientAddress,
          if (description != null && description.isNotEmpty)
            'description': description,
        });
        req.files.add(await http.MultipartFile.fromPath(
          'screenshot',
          screenshot.path,
          contentType: _imageMediaType(screenshot.path),
        ));
        final streamed = await req.send();
        final res = await http.Response.fromStream(streamed);
        return BookingResult.fromJson(_decode(res) as Map<String, dynamic>);
      });
}

/// Patient auth + self-service. Kept as an extension so the public booking
/// surface above stays untouched.
extension PatientApi on ApiClient {
  Future<int> requestOtp(String mobile) => _guard(() async {
        final res = await http.post(_uri('/patient/auth/request-otp'),
            headers: _authHeaders(), body: jsonEncode({'mobile': mobile}));
        final d = _decode(res) as Map<String, dynamic>;
        return (d['expiresInSeconds'] as num?)?.toInt() ?? 300;
      });

  Future<({String accessToken, Patient? patient, bool isNew})> verifyOtp(
    String mobile,
    String code,
  ) =>
      _guard(() async {
        final res = await http.post(_uri('/patient/auth/verify-otp'),
            headers: _authHeaders(),
            body: jsonEncode({'mobile': mobile, 'code': code}));
        final d = _decode(res) as Map<String, dynamic>;
        return (
          accessToken: d['accessToken'] as String,
          patient: d['patient'] == null
              ? null
              : Patient.fromJson(d['patient'] as Map<String, dynamic>),
          isNew: d['isNew'] as bool? ?? false,
        );
      });

  Future<({String mobile, bool registered, Patient? patient})> me() =>
      _guard(() async {
        final res =
            await http.get(_uri('/patient/me'), headers: _authHeaders());
        final d = _decode(res) as Map<String, dynamic>;
        return (
          mobile: d['mobile'] as String? ?? '',
          registered: d['registered'] as bool? ?? false,
          patient: d['patient'] == null
              ? null
              : Patient.fromJson(d['patient'] as Map<String, dynamic>),
        );
      });

  Future<Patient> updateMe(Map<String, dynamic> body) => _guard(() async {
        final res = await http.patch(_uri('/patient/me'),
            headers: _authHeaders(), body: jsonEncode(body));
        return Patient.fromJson(_decode(res) as Map<String, dynamic>);
      });

  Future<List<PatientAppointment>> myAppointments() => _guard(() async {
        final res = await http.get(_uri('/patient/appointments'),
            headers: _authHeaders());
        return (_decode(res) as List)
            .map((e) => PatientAppointment.fromJson(e as Map<String, dynamic>))
            .toList();
      });

  Future<PatientAppointment> myAppointment(String id) => _guard(() async {
        final res = await http.get(_uri('/patient/appointments/$id'),
            headers: _authHeaders());
        return PatientAppointment.fromJson(
            _decode(res) as Map<String, dynamic>);
      });

  Future<PatientReport> uploadReport(String appointmentId, File file) =>
      _guard(() async {
        final req = http.MultipartRequest(
            'POST', _uri('/patient/appointments/$appointmentId/reports'));
        if (tokens.token != null) {
          req.headers['Authorization'] = 'Bearer ${tokens.token}';
        }
        req.files.add(await http.MultipartFile.fromPath('file', file.path,
            contentType: _reportMediaType(file.path)));
        final res = await http.Response.fromStream(await req.send());
        return PatientReport.fromJson(_decode(res) as Map<String, dynamic>);
      });

  Future<void> deleteReport(String reportId) => _guard(() async {
        final res = await http.delete(_uri('/patient/reports/$reportId'),
            headers: _authHeaders());
        _decode(res);
      });

  /// Reports allow PDFs in addition to the image types the booking flow uses.
  MediaType _reportMediaType(String path) {
    final ext = path.toLowerCase().split('.').last;
    return switch (ext) {
      'pdf' => MediaType('application', 'pdf'),
      'png' => MediaType('image', 'png'),
      'webp' => MediaType('image', 'webp'),
      _ => MediaType('image', 'jpeg'),
    };
  }
}
