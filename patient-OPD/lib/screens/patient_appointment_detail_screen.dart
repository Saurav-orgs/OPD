import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/patient_auth.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'my_appointments_screen.dart';

class PatientAppointmentDetailScreen extends StatefulWidget {
  final String appointmentId;
  const PatientAppointmentDetailScreen({super.key, required this.appointmentId});

  @override
  State<PatientAppointmentDetailScreen> createState() =>
      _PatientAppointmentDetailScreenState();
}

class _PatientAppointmentDetailScreenState
    extends State<PatientAppointmentDetailScreen> {
  Future<PatientAppointment>? _future;
  bool _uploading = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _load();
  }

  Future<PatientAppointment> _load() =>
      PatientAuthScope.of(context).api.myAppointment(widget.appointmentId);

  void _reload() => setState(() => _future = _load());

  Future<void> _pickAndUpload() async {
    final picked = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
    );
    final path = picked?.path;
    if (path == null || !mounted) return;

    setState(() => _uploading = true);
    try {
      await PatientAuthScope.of(context)
          .api
          .uploadReport(widget.appointmentId, File(path));
      _reload();
      if (mounted) showSuccessSnack(context, 'Report uploaded');
    } on ApiException catch (e) {
      if (mounted) showErrorSnack(context, e.message);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _delete(PatientReport r) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Remove report?'),
        content: Text('"${r.fileName}" will be deleted.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Remove')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await PatientAuthScope.of(context).api.deleteReport(r.id);
      _reload();
    } on ApiException catch (e) {
      if (mounted) showErrorSnack(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Visit details')),
      body: FutureBuilder<PatientAppointment>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const StateView(loading: true);
          }
          if (snap.hasError || snap.data == null) {
            return StateView(
                error: 'Could not load this visit.', onRetry: _reload);
          }
          final a = snap.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(a.doctorName ?? 'Doctor',
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w700)),
                    if (a.doctorSpecialization != null)
                      Text(a.doctorSpecialization!,
                          style: const TextStyle(
                              color: AppColors.textSecondary, fontSize: 14)),
                    const SizedBox(height: 14),
                    _row(Icons.calendar_today_outlined,
                        '${formatDay(a.appointmentDate)} · ${a.startTime}–${a.endTime}'),
                    if (a.clinicName != null) ...[
                      const SizedBox(height: 8),
                      _row(Icons.business_outlined, a.clinicName!),
                    ],
                    if (a.description != null && a.description!.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Text('Reason for visit',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.textSecondary)),
                      Text(a.description!),
                    ],
                    if (a.doctorNotes != null && a.doctorNotes!.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text("Doctor's note",
                                style: TextStyle(fontWeight: FontWeight.w600)),
                            const SizedBox(height: 4),
                            Text(a.doctorNotes!),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Medical reports',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    const Text(
                      'Upload prior reports so the doctor can review them before your visit. PDF or image, up to 10 MB.',
                      style: TextStyle(
                          color: AppColors.textSecondary, fontSize: 13),
                    ),
                    const SizedBox(height: 12),
                    if (a.reports.isEmpty)
                      const Text('Nothing uploaded yet.',
                          style: TextStyle(color: AppColors.textSecondary))
                    else
                      ...a.reports.map((r) => _reportTile(r)),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _uploading ? null : _pickAndUpload,
                      icon: const Icon(Icons.upload_file, size: 18),
                      label: Text(_uploading ? 'Uploading…' : 'Upload report'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _row(IconData icon, String text) => Row(
        children: [
          Icon(icon, size: 15, color: AppColors.textSecondary),
          const SizedBox(width: 7),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 14))),
        ],
      );

  Widget _reportTile(PatientReport r) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(r.isPdf ? Icons.picture_as_pdf : Icons.image_outlined,
                color: AppColors.primary, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(r.fileName,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w500)),
                  Text(r.sizeLabel,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
            ),
            if (r.viewUrl != null)
              IconButton(
                tooltip: 'Open',
                icon: const Icon(Icons.open_in_new, size: 18),
                onPressed: () => launchUrl(Uri.parse(r.viewUrl!),
                    mode: LaunchMode.externalApplication),
              ),
            IconButton(
              tooltip: 'Remove',
              icon: const Icon(Icons.delete_outline,
                  size: 18, color: AppColors.error),
              onPressed: () => _delete(r),
            ),
          ],
        ),
      );
}
