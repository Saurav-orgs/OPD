import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/auth_scope.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'doctor_schedule_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  int _step = 0;
  OnboardingChecklist? _checklist;
  Doctor? _doctor;
  bool _loading = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final auth = AuthScope.of(context);
      final results = await Future.wait([
        auth.api.getOnboarding(),
        auth.api.getMe(),
      ]);
      final checklist = results[0] as OnboardingChecklist;
      final doctor = results[1] as Doctor;
      if (!mounted) return;
      if (checklist.complete) {
        Navigator.of(context).pop();
        return;
      }
      setState(() {
        _checklist = checklist;
        _doctor = doctor;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _advance() {
    if (_step < 5) {
      setState(() => _step++);
      _load();
    }
  }

  static const _steps = ['Profile', 'Photo', 'Fee', 'Payment QR', 'Schedule', 'Go live'];

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: StateView(loading: true));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Set up your practice'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: Column(
          children: [
            _StepBar(current: _step, labels: _steps),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: switch (_step) {
                  0 => _StepProfile(doctor: _doctor, onDone: _advance),
                  1 => _StepPhoto(onDone: _advance),
                  2 => _StepFee(doctor: _doctor, onDone: _advance),
                  3 => _StepQR(onDone: _advance),
                  4 => _StepSchedule(doctor: _doctor, onDone: _advance),
                  _ => _StepGoLive(checklist: _checklist),
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StepBar extends StatelessWidget {
  final int current;
  final List<String> labels;
  const _StepBar({required this.current, required this.labels});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      decoration: const BoxDecoration(
        color: AppColors.card,
        border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: labels.length,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final active = i == current;
          final done = i < current;
          return Center(
            child: GestureDetector(
              onTap: i <= current ? () {} : null,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: active ? AppColors.primary : (done ? AppColors.primaryTint : Colors.transparent),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: active ? AppColors.primary : AppColors.border,
                  ),
                ),
                child: Text(
                  labels[i],
                  style: TextStyle(
                    fontSize: 13,
                    color: active ? Colors.white : (done ? AppColors.primary : AppColors.textSecondary),
                    fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Step: Profile ──────────────────────────────────────────────

class _StepProfile extends StatefulWidget {
  final Doctor? doctor;
  final VoidCallback onDone;
  const _StepProfile({this.doctor, required this.onDone});

  @override
  State<_StepProfile> createState() => _StepProfileState();
}

class _StepProfileState extends State<_StepProfile> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _specCtrl;
  late final TextEditingController _qualCtrl;
  late final TextEditingController _bioCtrl;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.doctor?.name ?? '');
    _specCtrl = TextEditingController(text: widget.doctor?.specialization ?? '');
    _qualCtrl = TextEditingController(text: widget.doctor?.qualifications ?? '');
    _bioCtrl = TextEditingController(text: widget.doctor?.bio ?? '');
  }

  @override
  void dispose() {
    _nameCtrl.dispose(); _specCtrl.dispose(); _qualCtrl.dispose(); _bioCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      final auth = AuthScope.of(context);
      await auth.api.updateMe({
        'name': _nameCtrl.text.trim(),
        'specialization': _specCtrl.text.trim(),
        'qualifications': _qualCtrl.text.trim(),
        'bio': _bioCtrl.text.trim(),
      });
      widget.onDone();
    } on ApiException catch (e) {
      if (mounted) _snack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => _StepCard(
    title: 'Doctor profile',
    child: Column(
      children: [
        _tf('Name', _nameCtrl),
        const SizedBox(height: 12),
        _tf('Specialization', _specCtrl),
        const SizedBox(height: 12),
        _tf('Qualifications', _qualCtrl),
        const SizedBox(height: 12),
        _tf('Bio', _bioCtrl, maxLines: 3),
        const SizedBox(height: 20),
        ElevatedButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Save & continue')),
      ],
    ),
  );
}

// ── Step: Photo ────────────────────────────────────────────────

class _StepPhoto extends StatefulWidget {
  final VoidCallback onDone;
  const _StepPhoto({required this.onDone});

  @override
  State<_StepPhoto> createState() => _StepPhotoState();
}

class _StepPhotoState extends State<_StepPhoto> {
  bool _busy = false;

  Future<void> _pick() async {
    final picker = ImagePicker();
    final xf = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (xf == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final auth = AuthScope.of(context);
      await auth.api.uploadMyPhoto(File(xf.path));
      widget.onDone();
    } on ApiException catch (e) {
      if (mounted) _snack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => _StepCard(
    title: 'Profile photo',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ElevatedButton.icon(
          onPressed: _busy ? null : _pick,
          icon: const Icon(Icons.upload),
          label: Text(_busy ? 'Uploading…' : 'Upload photo'),
        ),
        const SizedBox(height: 12),
        TextButton(onPressed: widget.onDone, child: const Text('Skip for now')),
      ],
    ),
  );
}

// ── Step: Fee ──────────────────────────────────────────────────

class _StepFee extends StatefulWidget {
  final Doctor? doctor;
  final VoidCallback onDone;
  const _StepFee({this.doctor, required this.onDone});

  @override
  State<_StepFee> createState() => _StepFeeState();
}

class _StepFeeState extends State<_StepFee> {
  late final TextEditingController _ctrl;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.doctor?.consultationFee ?? '');
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      final auth = AuthScope.of(context);
      final fee = double.tryParse(_ctrl.text.trim());
      await auth.api.updateMe({'consultation_fee': fee});
      widget.onDone();
    } on ApiException catch (e) {
      if (mounted) _snack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => _StepCard(
    title: 'Consultation fee',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _tf('Fee (₹)', _ctrl, keyboardType: TextInputType.number),
        const SizedBox(height: 20),
        ElevatedButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Save & continue')),
        const SizedBox(height: 8),
        TextButton(onPressed: widget.onDone, child: const Text('Skip')),
      ],
    ),
  );
}

// ── Step: QR ───────────────────────────────────────────────────

class _StepQR extends StatefulWidget {
  final VoidCallback onDone;
  const _StepQR({required this.onDone});

  @override
  State<_StepQR> createState() => _StepQRState();
}

class _StepQRState extends State<_StepQR> {
  bool _busy = false;

  Future<void> _pick() async {
    final picker = ImagePicker();
    final xf = await picker.pickImage(source: ImageSource.gallery);
    if (xf == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final auth = AuthScope.of(context);
      await auth.api.uploadMyQr(File(xf.path));
      widget.onDone();
    } on ApiException catch (e) {
      if (mounted) _snack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => _StepCard(
    title: 'Payment QR code',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Patients will scan this QR to pay before booking.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: _busy ? null : _pick,
          icon: const Icon(Icons.qr_code),
          label: Text(_busy ? 'Uploading…' : 'Upload QR image'),
        ),
      ],
    ),
  );
}

// ── Step: Schedule ─────────────────────────────────────────────

class _StepSchedule extends StatelessWidget {
  final Doctor? doctor;
  final VoidCallback onDone;
  const _StepSchedule({this.doctor, required this.onDone});

  @override
  Widget build(BuildContext context) => _StepCard(
    title: 'OPD schedule',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Set your working hours so patients can pick slots.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: doctor == null
              ? null
              : () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => DoctorScheduleScreen(
                        doctorId: doctor!.id,
                        doctorName: doctor!.name,
                      ),
                    ),
                  ),
          icon: const Icon(Icons.schedule),
          label: const Text('Open schedule editor'),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: onDone,
          child: const Text("I've set my schedule — continue"),
        ),
      ],
    ),
  );
}

// ── Step: Go live ──────────────────────────────────────────────

class _StepGoLive extends StatefulWidget {
  final OnboardingChecklist? checklist;
  const _StepGoLive({this.checklist});

  @override
  State<_StepGoLive> createState() => _StepGoLiveState();
}

class _StepGoLiveState extends State<_StepGoLive> {
  bool _busy = false;

  Future<void> _goLive() async {
    setState(() => _busy = true);
    try {
      final auth = AuthScope.of(context);
      await auth.api.goLive();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Your practice is now live!'), backgroundColor: AppColors.secondary),
      );
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) _snack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.checklist;
    final checks = [
      (label: 'Doctor profile', done: c?.profile ?? false),
      (label: 'Payment QR', done: c?.paymentQr ?? false),
      (label: 'OPD schedule', done: c?.schedule ?? false),
    ];
    final canGoLive = (c?.paymentQr ?? false) && (c?.schedule ?? false);

    return _StepCard(
      title: 'Ready to go live?',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ...checks.map((ch) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Icon(
                      ch.done ? Icons.check_circle : Icons.cancel,
                      color: ch.done ? AppColors.secondary : AppColors.error,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Text(ch.label,
                        style: TextStyle(
                            color: ch.done ? AppColors.text : AppColors.textSecondary)),
                  ],
                ),
              )),
          const SizedBox(height: 20),
          if (!canGoLive)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Text(
                'Add a payment QR and schedule before going live.',
                style: TextStyle(color: AppColors.error, fontSize: 13),
              ),
            ),
          ElevatedButton(
            onPressed: (!canGoLive || _busy) ? null : _goLive,
            child: Text(_busy ? 'Going live…' : 'Go live'),
          ),
        ],
      ),
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────

class _StepCard extends StatelessWidget {
  final String title;
  final Widget child;
  const _StepCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) => SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CardTitle(title),
            const SizedBox(height: 16),
            child,
          ],
        ),
      );
}

Widget _tf(String label, TextEditingController ctrl, {int maxLines = 1, TextInputType? keyboardType}) =>
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.textSecondary)),
        const SizedBox(height: 4),
        TextFormField(
          controller: ctrl,
          maxLines: maxLines,
          keyboardType: keyboardType,
        ),
      ],
    );

void _snack(BuildContext context, String msg, {bool error = false}) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Text(msg),
    backgroundColor: error ? AppColors.error : AppColors.secondary,
  ));
}
