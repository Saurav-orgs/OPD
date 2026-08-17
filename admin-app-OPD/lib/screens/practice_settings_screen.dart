import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/auth_scope.dart';
import '../theme.dart';
import '../widgets/common.dart';

class PracticeSettingsScreen extends StatefulWidget {
  const PracticeSettingsScreen({super.key});

  @override
  State<PracticeSettingsScreen> createState() => _PracticeSettingsScreenState();
}

class _PracticeSettingsScreenState extends State<PracticeSettingsScreen> {
  Tenant? _tenant;
  OnboardingChecklist? _checklist;
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
      final results = await Future.wait([auth.api.getTenant(), auth.api.getOnboarding()]);
      if (!mounted) return;
      setState(() {
        _tenant = results[0] as Tenant;
        _checklist = results[1] as OnboardingChecklist;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const StateView(loading: true);
    if (_tenant == null) return const StateView(error: 'Could not load practice settings.');

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_checklist != null && !_checklist!.complete)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.primaryTint,
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, color: AppColors.primary, size: 18),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Onboarding not complete — finish your setup to go live.',
                      style: TextStyle(color: AppColors.primary, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          _InfoForm(tenant: _tenant!, onSaved: _load),
          const SizedBox(height: 16),
          _LogoSection(tenant: _tenant!, onSaved: _load),
          if (_tenant!.slug.isNotEmpty) ...[
            const SizedBox(height: 16),
            _PublicLink(slug: _tenant!.slug),
          ],
        ],
      ),
    );
  }
}

class _InfoForm extends StatefulWidget {
  final Tenant tenant;
  final VoidCallback onSaved;
  const _InfoForm({required this.tenant, required this.onSaved});

  @override
  State<_InfoForm> createState() => _InfoFormState();
}

class _InfoFormState extends State<_InfoForm> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _addressCtrl;
  late String _timezone;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final t = widget.tenant;
    _nameCtrl = TextEditingController(text: t.name);
    _emailCtrl = TextEditingController(text: t.contactEmail ?? '');
    _phoneCtrl = TextEditingController(text: t.contactPhone ?? '');
    _addressCtrl = TextEditingController(text: t.address ?? '');
    _timezone = t.timezone;
  }

  @override
  void dispose() {
    _nameCtrl.dispose(); _emailCtrl.dispose(); _phoneCtrl.dispose(); _addressCtrl.dispose();
    super.dispose();
  }

  static const _timezones = [
    ('Asia/Kolkata', 'Asia/Kolkata (IST)'),
    ('Asia/Dubai', 'Asia/Dubai (GST)'),
    ('UTC', 'UTC'),
    ('America/New_York', 'America/New_York (ET)'),
    ('Europe/London', 'Europe/London (GMT/BST)'),
  ];

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      final auth = AuthScope.of(context);
      await auth.api.updateTenant({
        'name': _nameCtrl.text.trim(),
        'contact_email': _emailCtrl.text.trim(),
        'contact_phone': _phoneCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'timezone': _timezone,
      });
      widget.onSaved();
      if (mounted) _snack(context, 'Practice info saved');
    } on ApiException catch (e) {
      if (mounted) _snack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CardTitle('Clinic details'),
            const SizedBox(height: 12),
            _lf('Practice name', _nameCtrl),
            const SizedBox(height: 12),
            _lf('Contact email', _emailCtrl, keyboardType: TextInputType.emailAddress),
            const SizedBox(height: 12),
            _lf('Contact phone', _phoneCtrl, keyboardType: TextInputType.phone),
            const SizedBox(height: 12),
            _lf('Address', _addressCtrl),
            const SizedBox(height: 12),
            Text('Timezone',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textSecondary)),
            const SizedBox(height: 4),
            DropdownButtonFormField<String>(
              // ignore: deprecated_member_use
              initialValue: _timezone,
              decoration: const InputDecoration(),
              items: _timezones
                  .map((tz) => DropdownMenuItem(value: tz.$1, child: Text(tz.$2, overflow: TextOverflow.ellipsis)))
                  .toList(),
              onChanged: (v) => setState(() => _timezone = v ?? _timezone),
            ),
            const SizedBox(height: 20),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Save')),
            ),
          ],
        ),
      );
}

class _LogoSection extends StatefulWidget {
  final Tenant tenant;
  final VoidCallback onSaved;
  const _LogoSection({required this.tenant, required this.onSaved});

  @override
  State<_LogoSection> createState() => _LogoSectionState();
}

class _LogoSectionState extends State<_LogoSection> {
  bool _busy = false;

  Future<void> _pick() async {
    final picker = ImagePicker();
    final xf = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (xf == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final auth = AuthScope.of(context);
      await auth.api.uploadLogo(File(xf.path));
      widget.onSaved();
      if (mounted) _snack(context, 'Logo updated');
    } on ApiException catch (e) {
      if (mounted) _snack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CardTitle('Practice logo'),
            const SizedBox(height: 12),
            if (widget.tenant.logoUrl != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(widget.tenant.logoUrl!, height: 80, fit: BoxFit.contain),
              )
            else
              Container(
                height: 80,
                width: 160,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Center(
                  child: Text('No logo', style: TextStyle(color: AppColors.textSecondary)),
                ),
              ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _busy ? null : _pick,
              icon: const Icon(Icons.upload),
              label: Text(_busy ? 'Uploading…' : 'Upload logo'),
            ),
            const SizedBox(height: 6),
            const Text('PNG or JPG, recommended 400×200 px.',
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ],
        ),
      );
}

class _PublicLink extends StatelessWidget {
  final String slug;
  const _PublicLink({required this.slug});

  @override
  Widget build(BuildContext context) => SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CardTitle('Public clinic link'),
            const SizedBox(height: 8),
            const Text('Share with patients to let them find your clinic.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('/c/$slug',
                        style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                        overflow: TextOverflow.ellipsis),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  tooltip: 'Copy link',
                  icon: const Icon(Icons.copy, size: 20),
                  onPressed: () => _snack(context, 'Link copied (implement clipboard)'),
                ),
              ],
            ),
          ],
        ),
      );
}

Widget _lf(String label, TextEditingController ctrl,
    {TextInputType? keyboardType}) =>
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.textSecondary)),
        const SizedBox(height: 4),
        TextFormField(controller: ctrl, keyboardType: keyboardType),
      ],
    );

void _snack(BuildContext context, String msg, {bool error = false}) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Text(msg),
    backgroundColor: error ? AppColors.error : AppColors.secondary,
  ));
}
