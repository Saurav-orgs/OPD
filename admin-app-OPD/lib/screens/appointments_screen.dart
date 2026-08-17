import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/auth_scope.dart';
import '../theme.dart';
import '../widgets/common.dart';

class AppointmentsScreen extends StatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  State<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends State<AppointmentsScreen> {
  String? _doctorId;
  String? _date;
  String? _status;
  String? _search;

  final _searchController = TextEditingController();
  Timer? _debounce;

  Future<List<Appointment>>? _future;
  List<Doctor> _doctors = [];

  AuthController get _auth => AuthScope.of(context);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _load();
    _maybeLoadDoctors();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  // Debounce the free-text search so we don't refetch on every keystroke.
  // Rebuild immediately so the clear (×) affordance tracks the field.
  void _onSearchChanged(String value) {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      final q = value.trim();
      final next = q.isEmpty ? null : q;
      if (next != _search) {
        _search = next;
        _apply();
      }
    });
  }

  Future<void> _maybeLoadDoctors() async {
    if (_doctors.isNotEmpty) return;
    if (_auth.user?.isDoctor ?? false) return; // doctors are auto-scoped
    if (!_auth.can('doctors', 'read')) return;
    try {
      final docs = await _auth.api.listDoctors();
      if (mounted) setState(() => _doctors = docs);
    } catch (_) {/* filter is optional */}
  }

  Future<List<Appointment>> _load() => _auth.api.listAppointments(
        doctorId: _doctorId,
        date: _date,
        status: _status,
        search: _search,
      );

  void _apply() => setState(() { _future = _load(); });

  Future<void> _refresh() async {
    _apply();
    await _future;
  }

  void _clear() {
    _debounce?.cancel();
    _searchController.clear();
    setState(() {
      _doctorId = null;
      _date = null;
      _status = null;
      _search = null;
      _future = _load();
    });
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 1),
    );
    if (picked != null) {
      _date =
          '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      _apply();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _filters(),
        Expanded(
          child: FutureBuilder<List<Appointment>>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const StateView(loading: true);
              }
              if (snap.hasError) {
                return StateView(
                    error: 'Could not load appointments.', onRetry: _refresh);
              }
              final list = snap.data ?? [];
              if (list.isEmpty) {
                return RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView(
                    children: const [
                      SizedBox(height: 120),
                      StateView(empty: 'No appointments match these filters.'),
                    ],
                  ),
                );
              }
              return RefreshIndicator(
                onRefresh: _refresh,
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) =>
                      _AppointmentTile(list[i], onChanged: _apply),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _filters() {
    final showDoctor =
        !(_auth.user?.isDoctor ?? false) && _doctors.isNotEmpty;
    return Container(
      color: AppColors.card,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(
        children: [
          TextField(
            controller: _searchController,
            onChanged: _onSearchChanged,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Search name or phone…',
              prefixIcon: const Icon(Icons.search, size: 20),
              isDense: true,
              suffixIcon: _searchController.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () {
                        _debounce?.cancel();
                        _searchController.clear();
                        if (_search != null) {
                          _search = null;
                          _apply();
                        } else {
                          setState(() {});
                        }
                      },
                    ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickDate,
                  icon: const Icon(Icons.calendar_today_outlined, size: 16),
                  label: Text(_date ?? 'Any date',
                      overflow: TextOverflow.ellipsis),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _status,
                  isExpanded: true,
                  decoration: const InputDecoration(
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
                  hint: const Text('Any status'),
                  items: const [
                    DropdownMenuItem(value: null, child: Text('Any status')),
                    DropdownMenuItem(
                        value: 'confirmed', child: Text('Confirmed')),
                    DropdownMenuItem(
                        value: 'rejected', child: Text('Rejected')),
                  ],
                  onChanged: (v) {
                    _status = v;
                    _apply();
                  },
                ),
              ),
            ],
          ),
          if (showDoctor) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _doctorId,
                    isExpanded: true,
                    decoration: const InputDecoration(
                        contentPadding: EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10)),
                    hint: const Text('All doctors'),
                    items: [
                      const DropdownMenuItem(
                          value: null, child: Text('All doctors')),
                      ..._doctors.map((d) => DropdownMenuItem(
                          value: d.id, child: Text(d.name))),
                    ],
                    onChanged: (v) {
                      _doctorId = v;
                      _apply();
                    },
                  ),
                ),
                const SizedBox(width: 10),
                TextButton(onPressed: _clear, child: const Text('Clear')),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _AppointmentTile extends StatelessWidget {
  final Appointment a;
  final VoidCallback onChanged;
  const _AppointmentTile(this.a, {required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadius.card),
      onTap: () async {
        final changed = await Navigator.push<bool>(
          context,
          MaterialPageRoute(
              builder: (_) => AppointmentDetailScreen(id: a.id)),
        );
        if (changed == true) onChanged();
      },
      child: SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(a.patientName,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
                Text('${a.appointmentDate} · ${a.startTime}',
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 4),
            Text(a.patientMobile,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 13)),
            if (a.doctor != null)
              Text(a.doctor!.name,
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 13)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                StatusBadge(a.paymentStatus),
                StatusBadge(a.consultationStatus),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class AppointmentDetailScreen extends StatefulWidget {
  final String id;
  const AppointmentDetailScreen({super.key, required this.id});

  @override
  State<AppointmentDetailScreen> createState() =>
      _AppointmentDetailScreenState();
}

class _AppointmentDetailScreenState extends State<AppointmentDetailScreen> {
  late Future<Appointment> _future;
  bool _changed = false;
  bool _busy = false;

  final _notes = TextEditingController();
  bool _notesSeeded = false;

  ApiClient get _api => AuthScope.of(context).api;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future = _api.getAppointment(widget.id);
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _run(Future<Appointment> Function() action, String ok) async {
    setState(() => _busy = true);
    try {
      await action();
      _changed = true;
      setState(() { _future = _api.getAppointment(widget.id); });
      if (mounted) showSuccessSnack(context, ok);
    } on ApiException catch (e) {
      if (mounted) showErrorSnack(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canUpdate = AuthScope.of(context).can('appointments', 'update');
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _changed);
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Appointment')),
        body: FutureBuilder<Appointment>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const StateView(loading: true);
            }
            if (snap.hasError) {
              return const StateView(error: 'Could not load this appointment.');
            }
            final a = snap.data!;
            // Seed the note editor once from the loaded appointment.
            if (!_notesSeeded) {
              _notes.text = a.doctorNotes ?? '';
              _notesSeeded = true;
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _row('Patient', a.patientName),
                      _row('Mobile', a.patientMobile),
                      if (a.patientAge != null || a.patientGender != null)
                        _row(
                          'Age / gender',
                          [
                            if (a.patientAge != null) '${a.patientAge} yrs',
                            if (a.patientGender != null) a.patientGender!,
                          ].join(' · '),
                        ),
                      _row('Date & time',
                          '${a.appointmentDate} · ${a.startTime}–${a.endTime}'),
                      _row('Doctor', a.doctor?.name ?? '—'),
                      if (a.patientAddress != null &&
                          a.patientAddress!.isNotEmpty)
                        _row('Address', a.patientAddress!),
                      if (a.description != null && a.description!.isNotEmpty)
                        _row('Reason', a.description!),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: [
                          StatusBadge(a.status),
                          StatusBadge(a.paymentStatus),
                          StatusBadge(a.consultationStatus),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _notesCard(a, canUpdate),
                const SizedBox(height: 16),
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const CardTitle('Payment screenshot'),
                      if (a.screenshotUrl != null &&
                          a.screenshotUrl!.isNotEmpty)
                        ClipRRect(
                          borderRadius:
                              BorderRadius.circular(AppRadius.control),
                          child: Image.network(
                            a.screenshotUrl!,
                            width: double.infinity,
                            fit: BoxFit.contain,
                            errorBuilder: (_, _, _) => const Text(
                                'Could not load the screenshot.',
                                style: TextStyle(
                                    color: AppColors.textSecondary)),
                          ),
                        )
                      else
                        const Text('No screenshot.',
                            style: TextStyle(color: AppColors.textSecondary)),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _reportsCard(a),
                if (canUpdate) ...[
                  const SizedBox(height: 16),
                  _reviewCard(a),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _notesCard(Appointment a, bool canUpdate) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const CardTitle('Doctor’s note'),
          const Text(
            'Shown when this patient books their next OPD.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 10),
          if (canUpdate) ...[
            TextField(
              controller: _notes,
              minLines: 3,
              maxLines: 6,
              maxLength: 2000,
              decoration: const InputDecoration(
                hintText: 'Add a note for this patient’s next visit…',
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton(
                onPressed: _busy
                    ? null
                    : () => _run(() => _api.setNotes(a.id, _notes.text.trim()),
                        'Note saved'),
                child: const Text('Save note'),
              ),
            ),
          ] else
            Text(
              (a.doctorNotes != null && a.doctorNotes!.isNotEmpty)
                  ? a.doctorNotes!
                  : 'No note yet.',
              style: TextStyle(
                color: (a.doctorNotes != null && a.doctorNotes!.isNotEmpty)
                    ? AppColors.text
                    : AppColors.textSecondary,
              ),
            ),
        ],
      ),
    );
  }

  /// Reports the patient uploaded for this visit, opened via presigned URLs.
  Widget _reportsCard(Appointment a) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardTitle('Patient reports'
              '${a.reports.isNotEmpty ? ' (${a.reports.length})' : ''}'),
          const SizedBox(height: 8),
          if (a.reports.isEmpty)
            const Text('No reports uploaded.',
                style: TextStyle(color: AppColors.textSecondary))
          else
            ...a.reports.map(
              (r) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(r.isPdf ? Icons.picture_as_pdf : Icons.image_outlined,
                        size: 20, color: AppColors.primary),
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
                                  fontSize: 12,
                                  color: AppColors.textSecondary)),
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
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _reviewCard(Appointment a) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const CardTitle('Payment review'),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: _busy
                      ? null
                      : () => _run(() => _api.setPayment(a.id, 'verified'),
                          'Payment verified'),
                  child: const Text('Verify'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => _run(() => _api.setPayment(a.id, 'rejected'),
                          'Payment rejected — slot freed'),
                  style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(color: AppColors.error, width: 0.8)),
                  child: const Text('Reject'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text('Rejecting frees the slot if it is still in the future.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          const Divider(height: 28),
          const CardTitle('Consultation outcome'),
          Wrap(
            spacing: 10,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: _busy
                    ? null
                    : () => _run(() => _api.setConsultation(a.id, 'done'),
                        'Marked as done'),
                child: const Text('Done'),
              ),
              OutlinedButton(
                onPressed: _busy
                    ? null
                    : () => _run(() => _api.setConsultation(a.id, 'on_hold'),
                        'Put on hold'),
                child: const Text('On hold'),
              ),
              OutlinedButton(
                onPressed: _busy
                    ? null
                    : () => _run(() => _api.setConsultation(a.id, 'rejected'),
                        'Consultation rejected'),
                style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.error,
                    side: const BorderSide(color: AppColors.error, width: 0.8)),
                child: const Text('Reject'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 12)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 15)),
        ],
      ),
    );
  }
}
