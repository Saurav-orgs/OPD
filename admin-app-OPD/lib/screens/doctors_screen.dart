import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/auth_scope.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'doctor_schedule_screen.dart';

class DoctorsScreen extends StatefulWidget {
  const DoctorsScreen({super.key});

  @override
  State<DoctorsScreen> createState() => _DoctorsScreenState();
}

class _DoctorsScreenState extends State<DoctorsScreen> {
  Future<List<Doctor>>? _future;
  bool _busyId = false;

  AuthController get _auth => AuthScope.of(context);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _auth.api.listDoctors();
  }

  void _reload() => setState(() { _future = _auth.api.listDoctors(); });

  Future<void> _refresh() async {
    _reload();
    await _future;
  }

  Future<void> _toggle(Doctor d) async {
    setState(() => _busyId = true);
    try {
      d.isEnabled
          ? await _auth.api.disableDoctor(d.id)
          : await _auth.api.enableDoctor(d.id);
      _reload();
      if (mounted) {
        showSuccessSnack(
            context, d.isEnabled ? 'Doctor disabled' : 'Doctor enabled');
      }
    } on ApiException catch (e) {
      if (mounted) showErrorSnack(context, e.message);
    } finally {
      if (mounted) setState(() => _busyId = false);
    }
  }

  Future<void> _openForm(Doctor? doctor) async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => DoctorFormScreen(doctor: doctor)),
    );
    if (saved == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    final canCreate = _auth.can('doctors', 'create');
    final canUpdate = _auth.can('doctors', 'update');
    final canSchedule = _auth.can('opd_schedules', 'read');

    return Scaffold(
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              onPressed: () => _openForm(null),
              icon: const Icon(Icons.add),
              label: const Text('Add doctor'),
            )
          : null,
      body: FutureBuilder<List<Doctor>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const StateView(loading: true);
          }
          if (snap.hasError) {
            return StateView(
                error: 'Could not load doctors.', onRetry: _refresh);
          }
          final list = snap.data ?? [];
          if (list.isEmpty) {
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(children: const [
                SizedBox(height: 120),
                StateView(empty: 'No doctors yet.'),
              ]),
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final d = list[i];
                return SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          NetworkThumb(
                              url: d.profilePhotoUrl,
                              size: 48,
                              fallback: Icons.person),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(d.name,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 15)),
                                Text(d.specialization ?? '—',
                                    style: const TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 13)),
                                Text(d.feeLabel,
                                    style: const TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 13)),
                              ],
                            ),
                          ),
                          StatusBadge(d.isEnabled ? 'enabled' : 'disabled',
                              label: d.isEnabled ? 'Enabled' : 'Disabled'),
                        ],
                      ),
                      if (canUpdate || canSchedule) ...[
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          alignment: WrapAlignment.end,
                          children: [
                            if (canSchedule)
                              OutlinedButton.icon(
                                onPressed: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => DoctorScheduleScreen(
                                        doctorId: d.id, doctorName: d.name),
                                  ),
                                ),
                                icon: const Icon(Icons.schedule, size: 16),
                                label: const Text('Schedule'),
                              ),
                            if (canUpdate)
                              OutlinedButton.icon(
                                onPressed: () => _openForm(d),
                                icon: const Icon(Icons.edit_outlined, size: 16),
                                label: const Text('Edit'),
                              ),
                            if (canUpdate)
                              OutlinedButton(
                                onPressed: _busyId ? null : () => _toggle(d),
                                child: Text(d.isEnabled ? 'Disable' : 'Enable'),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class DoctorFormScreen extends StatefulWidget {
  final Doctor? doctor;
  const DoctorFormScreen({super.key, this.doctor});

  @override
  State<DoctorFormScreen> createState() => _DoctorFormScreenState();
}

class _DoctorFormScreenState extends State<DoctorFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _specialization;
  late final TextEditingController _qualifications;
  late final TextEditingController _fee;
  late final TextEditingController _bio;

  File? _photoFile;
  File? _qrFile;
  bool _saving = false;

  ApiClient get _api => AuthScope.of(context).api;
  Doctor? get _doctor => widget.doctor;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: _doctor?.name ?? '');
    _specialization = TextEditingController(text: _doctor?.specialization ?? '');
    _qualifications = TextEditingController(text: _doctor?.qualifications ?? '');
    _fee = TextEditingController(text: _doctor?.consultationFee ?? '');
    _bio = TextEditingController(text: _doctor?.bio ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _specialization.dispose();
    _qualifications.dispose();
    _fee.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _pick(bool photo) async {
    final picked = await ImagePicker()
        .pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;
    setState(() {
      if (photo) {
        _photoFile = File(picked.path);
      } else {
        _qrFile = File(picked.path);
      }
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{
        'name': _name.text.trim(),
        'specialization':
            _specialization.text.trim().isEmpty ? null : _specialization.text.trim(),
        'qualifications':
            _qualifications.text.trim().isEmpty ? null : _qualifications.text.trim(),
        'bio': _bio.text.trim().isEmpty ? null : _bio.text.trim(),
        'consultation_fee':
            _fee.text.trim().isEmpty ? null : num.tryParse(_fee.text.trim()),
      };
      // Create/update first to obtain the id the upload endpoints need.
      final saved = _doctor == null
          ? await _api.createDoctor(body)
          : await _api.updateDoctor(_doctor!.id, body);
      if (_photoFile != null) await _api.uploadDoctorPhoto(saved.id, _photoFile!);
      if (_qrFile != null) await _api.uploadDoctorQr(saved.id, _qrFile!);
      if (mounted) {
        showSuccessSnack(
            context, _doctor == null ? 'Doctor created' : 'Doctor updated');
        Navigator.pop(context, true);
      }
    } on ApiException catch (e) {
      if (mounted) showErrorSnack(context, e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_doctor == null ? 'Add doctor' : 'Edit doctor')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            LabeledField(
              label: 'Name',
              child: TextFormField(
                controller: _name,
                validator: (v) =>
                    (v ?? '').trim().length < 2 ? 'Name is required.' : null,
              ),
            ),
            LabeledField(
              label: 'Specialization',
              child: TextFormField(controller: _specialization),
            ),
            LabeledField(
              label: 'Qualifications',
              child: TextFormField(controller: _qualifications),
            ),
            LabeledField(
              label: 'Consultation fee (₹)',
              child: TextFormField(
                controller: _fee,
                keyboardType: TextInputType.number,
              ),
            ),
            LabeledField(
              label: 'Bio',
              child: TextFormField(controller: _bio, maxLines: 3),
            ),
            const SizedBox(height: 4),
            _imageCard(
              title: 'Profile photo',
              subtitle: 'Shown to patients.',
              current: _doctor?.profilePhotoUrl,
              file: _photoFile,
              onPick: () => _pick(true),
            ),
            const SizedBox(height: 12),
            _imageCard(
              title: 'Payment QR',
              subtitle: 'Shown on the booking screen.',
              current: _doctor?.paymentQrUrl,
              file: _qrFile,
              onPick: () => _pick(false),
            ),
            const SizedBox(height: 20),
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2.2, color: Colors.white))
                    : const Text('Save'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _imageCard({
    required String title,
    required String subtitle,
    required String? current,
    required File? file,
    required VoidCallback onPick,
  }) {
    Widget preview;
    if (file != null) {
      preview = ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.file(file, width: 56, height: 56, fit: BoxFit.cover),
      );
    } else {
      preview =
          NetworkThumb(url: current, size: 56, fallback: Icons.image_outlined);
    }
    return SectionCard(
      child: Row(
        children: [
          preview,
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(fontWeight: FontWeight.w500)),
                Text(subtitle,
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 12)),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: onPick,
            child: Text((file != null || current != null) ? 'Change' : 'Upload'),
          ),
        ],
      ),
    );
  }
}
