/// The practice a doctor belongs to (multi-tenant).
class Clinic {
  final String id;
  final String name;
  final String slug;
  final String? logoUrl;
  final String? address;
  final String? contactPhone;

  Clinic({
    required this.id,
    required this.name,
    required this.slug,
    this.logoUrl,
    this.address,
    this.contactPhone,
  });

  factory Clinic.fromJson(Map<String, dynamic> j) => Clinic(
        id: j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        slug: j['slug'] as String? ?? '',
        logoUrl: j['logo_url'] as String?,
        address: j['address'] as String?,
        contactPhone: j['contact_phone'] as String?,
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
  final Clinic? clinic;

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
    this.clinic,
  });

  factory Doctor.fromJson(Map<String, dynamic> j) => Doctor(
        id: j['id'] as String,
        name: j['name'] as String,
        specialization: j['specialization'] as String?,
        qualifications: j['qualifications'] as String?,
        bio: j['bio'] as String?,
        consultationFee: j['consultation_fee']?.toString(),
        profilePhotoUrl: j['profile_photo_url'] as String?,
        paymentQrUrl: j['payment_qr_url'] as String?,
        clinic: j['clinic'] == null
            ? null
            : Clinic.fromJson(j['clinic'] as Map<String, dynamic>),
        publicSlug: j['public_slug'] as String? ?? '',
      );

  String get feeLabel =>
      consultationFee == null ? '' : '₹$consultationFee';
}

enum SlotStatus { available, booked, past }

class Slot {
  final String startTime; // HH:mm
  final String endTime; // HH:mm
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

  bool get selectable => status == SlotStatus.available;
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
        date: j['date'] as String,
        available: j['available'] as bool? ?? false,
        reason: j['reason'] as String?,
        slots: ((j['slots'] as List?) ?? [])
            .map((s) => Slot.fromJson(s as Map<String, dynamic>))
            .toList(),
      );

  String get unavailableLabel => switch (reason) {
        'leave' => 'The doctor is on leave this day.',
        'no_opd' => 'No OPD hours on this day.',
        'out_of_window' => 'Bookings open only for the next 7 days.',
        _ => 'Not available.',
      };
}

class BookingResult {
  final String id;
  final String appointmentDate;
  final String startTime;
  final String endTime;
  final String patientName;
  final String? doctorName;

  BookingResult({
    required this.id,
    required this.appointmentDate,
    required this.startTime,
    required this.endTime,
    required this.patientName,
    this.doctorName,
  });

  factory BookingResult.fromJson(Map<String, dynamic> j) => BookingResult(
        id: j['id'] as String,
        appointmentDate: j['appointment_date'] as String,
        startTime: (j['start_time'] as String).substring(0, 5),
        endTime: (j['end_time'] as String).substring(0, 5),
        patientName: j['patient_name'] as String,
        doctorName: (j['doctor'] as Map<String, dynamic>?)?['name'] as String?,
      );
}

// ── Patient registry ─────────────────────────────────────────

class Patient {
  final String id;
  final String mobile;
  final String name;
  final int? age;
  final String? gender;

  Patient({
    required this.id,
    required this.mobile,
    required this.name,
    this.age,
    this.gender,
  });

  factory Patient.fromJson(Map<String, dynamic> j) => Patient(
        id: j['id'] as String,
        mobile: j['mobile'] as String? ?? '',
        name: j['name'] as String? ?? '',
        age: (j['age'] as num?)?.toInt(),
        gender: j['gender'] as String?,
      );

  bool get isComplete => name.isNotEmpty && age != null && gender != null;
}

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

class PatientAppointment {
  final String id;
  final String appointmentDate;
  final String startTime;
  final String endTime;
  final String status;
  final String consultationStatus;
  final String paymentStatus;
  final String? description;
  final String? doctorNotes;
  final String? doctorName;
  final String? doctorSpecialization;
  final String? clinicName;
  final List<PatientReport> reports;

  PatientAppointment({
    required this.id,
    required this.appointmentDate,
    required this.startTime,
    required this.endTime,
    required this.status,
    required this.consultationStatus,
    required this.paymentStatus,
    this.description,
    this.doctorNotes,
    this.doctorName,
    this.doctorSpecialization,
    this.clinicName,
    this.reports = const [],
  });

  static String _hhmm(String? t) =>
      (t != null && t.length >= 5) ? t.substring(0, 5) : (t ?? '');

  factory PatientAppointment.fromJson(Map<String, dynamic> j) {
    final doc = j['doctor'] as Map<String, dynamic>?;
    final clinic = j['clinic'] as Map<String, dynamic>?;
    return PatientAppointment(
      id: j['id'] as String,
      appointmentDate: j['appointment_date'] as String? ?? '',
      startTime: _hhmm(j['start_time'] as String?),
      endTime: _hhmm(j['end_time'] as String?),
      status: j['status'] as String? ?? 'confirmed',
      consultationStatus: j['consultation_status'] as String? ?? 'pending',
      paymentStatus: j['payment_status'] as String? ?? 'paid_unverified',
      description: j['description'] as String?,
      doctorNotes: j['doctor_notes'] as String?,
      doctorName: doc?['name'] as String?,
      doctorSpecialization: doc?['specialization'] as String?,
      clinicName: clinic?['name'] as String?,
      reports: ((j['reports'] as List?) ?? [])
          .map((r) => PatientReport.fromJson(r as Map<String, dynamic>))
          .toList(),
    );
  }
}
