import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config.dart';
import 'models.dart';

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
