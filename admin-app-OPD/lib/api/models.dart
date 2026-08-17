// Data models mirroring the backend response envelope (admin web `types.ts`).

String? _str(dynamic v) => v?.toString();

class AuthUser {
  final String id;
  final String email;
  final String name;
  final String type; // super_admin | admin | doctor
  final String? roleId;
  final String? doctorId;
  final String? tenantId;
  final String? tenantStatus; // active | suspended
  final List<String> permissions; // "module:action"

  AuthUser({
    required this.id,
    required this.email,
    required this.name,
    required this.type,
    this.roleId,
    this.doctorId,
    this.tenantId,
    this.tenantStatus,
    required this.permissions,
  });

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: j['id'] as String,
        email: j['email'] as String? ?? '',
        name: j['name'] as String? ?? '',
        type: j['type'] as String? ?? 'admin',
        roleId: j['roleId'] as String?,
        doctorId: j['doctorId'] as String?,
        tenantId: j['tenantId'] as String?,
        tenantStatus: j['tenantStatus'] as String?,
        permissions:
            ((j['permissions'] as List?) ?? []).map((e) => '$e').toList(),
      );

  bool get isDoctor => type == 'doctor';
  bool get isSuperAdmin => type == 'super_admin';

  /// RBAC check mirroring the web `can(module, action)`.
  bool can(String module, String action) {
    if (isSuperAdmin) return true;
    return permissions.contains('$module:$action');
  }
}

class LoginResponse {
  final String accessToken;
  final AuthUser user;
  LoginResponse({required this.accessToken, required this.user});

  factory LoginResponse.fromJson(Map<String, dynamic> j) => LoginResponse(
        accessToken: j['accessToken'] as String,
        user: AuthUser.fromJson(j['user'] as Map<String, dynamic>),
      );
}

class Permission {
  final String id;
  final String module;
  final String action;
  Permission({required this.id, required this.module, required this.action});

  factory Permission.fromJson(Map<String, dynamic> j) => Permission(
        id: j['id'] as String,
        module: j['module'] as String,
        action: j['action'] as String,
      );
}

class Role {
  final String id;
  final String name;
  final String? description;
  final bool isSystem;
  final List<Permission> permissions;

  Role({
    required this.id,
    required this.name,
    this.description,
    required this.isSystem,
    required this.permissions,
  });

  factory Role.fromJson(Map<String, dynamic> j) => Role(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        description: j['description'] as String?,
        isSystem: j['is_system'] as bool? ?? false,
        permissions: ((j['permissions'] as List?) ?? [])
            .map((p) => Permission.fromJson(p as Map<String, dynamic>))
            .toList(),
      );
}

class Doctor {
  final String id;
  final String name;
  final String? specialization;
  final String? qualifications;
  final String? bio;
  final String? consultationFee;
  final String? profilePhotoUrl;
  final String? paymentQrUrl;
  final String publicSlug;
  final bool isEnabled;

  Doctor({
    required this.id,
    required this.name,
    this.specialization,
    this.qualifications,
    this.bio,
    this.consultationFee,
    this.profilePhotoUrl,
    this.paymentQrUrl,
    required this.publicSlug,
    required this.isEnabled,
  });

  factory Doctor.fromJson(Map<String, dynamic> j) => Doctor(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        specialization: j['specialization'] as String?,
        qualifications: j['qualifications'] as String?,
        bio: j['bio'] as String?,
        consultationFee: _str(j['consultation_fee']),
        profilePhotoUrl: j['profile_photo_url'] as String?,
        paymentQrUrl: j['payment_qr_url'] as String?,
        publicSlug: j['public_slug'] as String? ?? '',
        isEnabled: j['is_enabled'] as bool? ?? false,
      );

  String get feeLabel => consultationFee == null ? '—' : '₹$consultationFee';
}

class User {
  final String id;
  final String name;
  final String email;
  final String type;
  final String? roleId;
  final String? doctorId;
  final bool isActive;
  final Role? role;
  final Doctor? doctor;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.type,
    this.roleId,
    this.doctorId,
    required this.isActive,
    this.role,
    this.doctor,
  });

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        email: j['email'] as String? ?? '',
        type: j['type'] as String? ?? 'admin',
        roleId: j['role_id'] as String?,
        doctorId: j['doctor_id'] as String?,
        isActive: j['is_active'] as bool? ?? true,
        role: j['role'] == null
            ? null
            : Role.fromJson(j['role'] as Map<String, dynamic>),
        doctor: j['doctor'] == null
            ? null
            : Doctor.fromJson(j['doctor'] as Map<String, dynamic>),
      );
}

class ScheduleEntry {
  final String? id;
  final int dayOfWeek;
  final String startTime; // HH:mm
  final String endTime; // HH:mm
  final int slotDurationMin;

  ScheduleEntry({
    this.id,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    required this.slotDurationMin,
  });

  static String _hhmm(String t) => t.length >= 5 ? t.substring(0, 5) : t;

  factory ScheduleEntry.fromJson(Map<String, dynamic> j) => ScheduleEntry(
        id: j['id'] as String?,
        dayOfWeek: (j['day_of_week'] as num).toInt(),
        startTime: _hhmm(j['start_time'] as String),
        endTime: _hhmm(j['end_time'] as String),
        slotDurationMin: (j['slot_duration_min'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'day_of_week': dayOfWeek,
        'start_time': startTime,
        'end_time': endTime,
        'slot_duration_min': slotDurationMin,
      };
}

enum SlotStatus { available, booked, past }

class Slot {
  final String startTime;
  final String endTime;
  final SlotStatus status;
  Slot({required this.startTime, required this.endTime, required this.status});

  factory Slot.fromJson(Map<String, dynamic> j) => Slot(
        startTime: j['start_time'] as String,
        endTime: j['end_time'] as String,
        status: switch (j['status']) {
          'booked' => SlotStatus.booked,
          'past' => SlotStatus.past,
          _ => SlotStatus.available,
        },
      );
}

class DaySlots {
  final String date;
  final bool available;
  final String? reason; // leave | no_opd | out_of_window
  final List<Slot> slots;

  DaySlots({
    required this.date,
    required this.available,
    this.reason,
    required this.slots,
  });

  factory DaySlots.fromJson(Map<String, dynamic> j) => DaySlots(
        date: j['date'] as String? ?? '',
        available: j['available'] as bool? ?? false,
        reason: j['reason'] as String?,
        slots: ((j['slots'] as List?) ?? [])
            .map((s) => Slot.fromJson(s as Map<String, dynamic>))
            .toList(),
      );

  String get unavailableLabel => switch (reason) {
        'leave' => 'On leave this day.',
        'no_opd' => 'No OPD hours on this day.',
        'out_of_window' => 'Outside the booking window.',
        _ => 'Not available.',
      };
}

class LeaveDay {
  final String id;
  final String date;
  final String? reason;
  LeaveDay({required this.id, required this.date, this.reason});

  factory LeaveDay.fromJson(Map<String, dynamic> j) => LeaveDay(
        id: j['id'] as String,
        date: j['date'] as String,
        reason: j['reason'] as String?,
      );
}

class DoctorRef {
  final String id;
  final String name;
  final String? specialization;
  final String? consultationFee;
  DoctorRef({
    required this.id,
    required this.name,
    this.specialization,
    this.consultationFee,
  });

  factory DoctorRef.fromJson(Map<String, dynamic> j) => DoctorRef(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        specialization: j['specialization'] as String?,
        consultationFee: _str(j['consultation_fee']),
      );
}

class Appointment {
  final String id;
  final String doctorId;
  final String appointmentDate;
  final String startTime;
  final String endTime;
  final String patientName;
  final String patientMobile;
  final String? patientAddress;
  final String? description;
  final String? doctorNotes;
  final String status; // confirmed | rejected
  final String consultationStatus; // pending | done | on_hold | rejected
  final String paymentStatus; // paid_unverified | verified | rejected
  final String? source;
  final DoctorRef? doctor;
  final String? screenshotUrl; // presigned, only on detail
  final int? patientAge;
  final String? patientGender;
  final List<PatientReport> reports;

  Appointment({
    required this.id,
    required this.doctorId,
    required this.appointmentDate,
    required this.startTime,
    required this.endTime,
    required this.patientName,
    required this.patientMobile,
    this.patientAddress,
    this.description,
    this.doctorNotes,
    required this.status,
    required this.consultationStatus,
    required this.paymentStatus,
    this.source,
    this.doctor,
    this.screenshotUrl,
    this.patientAge,
    this.patientGender,
    this.reports = const [],
  });

  static String _hhmm(String? t) =>
      (t != null && t.length >= 5) ? t.substring(0, 5) : (t ?? '');

  factory Appointment.fromJson(Map<String, dynamic> j) => Appointment(
        id: j['id'] as String,
        doctorId: j['doctor_id'] as String? ?? '',
        appointmentDate: j['appointment_date'] as String? ?? '',
        startTime: _hhmm(j['start_time'] as String?),
        endTime: _hhmm(j['end_time'] as String?),
        patientName: j['patient_name'] as String? ?? '',
        patientMobile: j['patient_mobile'] as String? ?? '',
        patientAddress: j['patient_address'] as String?,
        description: j['description'] as String?,
        doctorNotes: j['doctor_notes'] as String?,
        status: j['status'] as String? ?? 'confirmed',
        consultationStatus: j['consultation_status'] as String? ?? 'pending',
        paymentStatus: j['payment_status'] as String? ?? 'paid_unverified',
        source: j['source'] as String?,
        doctor: j['doctor'] == null
            ? null
            : DoctorRef.fromJson(j['doctor'] as Map<String, dynamic>),
        screenshotUrl: j['screenshot_url'] as String?,
        patientAge: (j['patient_age'] as num?)?.toInt(),
        patientGender: j['patient_gender'] as String?,
        reports: ((j['reports'] as List?) ?? [])
            .map((r) => PatientReport.fromJson(r as Map<String, dynamic>))
            .toList(),
      );
}

class DashboardSummary {
  final String date;
  final int total;
  final Map<String, int> byStatus;
  final List<Appointment> appointments;

  DashboardSummary({
    required this.date,
    required this.total,
    required this.byStatus,
    required this.appointments,
  });

  factory DashboardSummary.fromJson(Map<String, dynamic> j) => DashboardSummary(
        date: j['date'] as String? ?? '',
        total: (j['total'] as num?)?.toInt() ?? 0,
        byStatus: ((j['byStatus'] as Map?) ?? {}).map(
          (k, v) => MapEntry('$k', (v as num?)?.toInt() ?? 0),
        ),
        appointments: ((j['appointments'] as List?) ?? [])
            .map((a) => Appointment.fromJson(a as Map<String, dynamic>))
            .toList(),
      );

  int status(String key) => byStatus[key] ?? 0;
}

class Tenant {
  final String id;
  final String name;
  final String slug;
  final String? contactEmail;
  final String? contactPhone;
  final String? address;
  final String? logoUrl;
  final String timezone;
  final String status;

  Tenant({
    required this.id,
    required this.name,
    required this.slug,
    this.contactEmail,
    this.contactPhone,
    this.address,
    this.logoUrl,
    required this.timezone,
    required this.status,
  });

  factory Tenant.fromJson(Map<String, dynamic> j) => Tenant(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        slug: j['slug'] as String? ?? '',
        contactEmail: j['contact_email'] as String?,
        contactPhone: j['contact_phone'] as String?,
        address: j['address'] as String?,
        logoUrl: j['logo_url'] as String?,
        timezone: j['timezone'] as String? ?? 'Asia/Kolkata',
        status: j['status'] as String? ?? 'active',
      );
}

class OnboardingChecklist {
  final bool profile;
  final bool photo;
  final bool consultationFee;
  final bool paymentQr;
  final bool schedule;
  final bool complete;

  OnboardingChecklist({
    required this.profile,
    required this.photo,
    required this.consultationFee,
    required this.paymentQr,
    required this.schedule,
    required this.complete,
  });

  factory OnboardingChecklist.fromJson(Map<String, dynamic> j) =>
      OnboardingChecklist(
        profile: j['profile'] as bool? ?? false,
        photo: j['photo'] as bool? ?? false,
        consultationFee: j['consultation_fee'] as bool? ?? false,
        paymentQr: j['payment_qr'] as bool? ?? false,
        schedule: j['schedule'] as bool? ?? false,
        complete: j['complete'] as bool? ?? false,
      );
}


/// A medical report the patient uploaded for an appointment.
class PatientReport {
  final String id;
  final String fileName;
  final String mimeType;
  final int sizeBytes;
  final String? viewUrl;

  PatientReport({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
    this.viewUrl,
  });

  factory PatientReport.fromJson(Map<String, dynamic> j) => PatientReport(
        id: j['id'] as String,
        fileName: j['file_name'] as String? ?? 'report',
        mimeType: j['mime_type'] as String? ?? '',
        sizeBytes: (j['size_bytes'] as num?)?.toInt() ?? 0,
        viewUrl: j['view_url'] as String?,
      );

  bool get isPdf => mimeType == 'application/pdf';

  String get sizeLabel {
    if (sizeBytes < 1024) return '$sizeBytes B';
    if (sizeBytes < 1024 * 1024) return '${(sizeBytes / 1024).round()} KB';
    return '${(sizeBytes / 1048576).toStringAsFixed(1)} MB';
  }
}

/// Shareable QR for a doctor's public booking page.
class BookingQr {
  final String url;
  final String qrDataUrl;
  final String shareText;

  BookingQr({
    required this.url,
    required this.qrDataUrl,
    required this.shareText,
  });

  factory BookingQr.fromJson(Map<String, dynamic> j) => BookingQr(
        url: j['url'] as String? ?? '',
        qrDataUrl: j['qr_data_url'] as String? ?? '',
        shareText: j['share_text'] as String? ?? '',
      );
}
