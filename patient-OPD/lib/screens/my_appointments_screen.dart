import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/patient_auth.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'patient_appointment_detail_screen.dart';

String formatDay(String iso) {
  try {
    return DateFormat('EEE, d MMM yyyy').format(DateTime.parse(iso));
  } catch (_) {
    return iso;
  }
}

({Color bg, Color fg, String label}) statusStyle(String s) => switch (s) {
      'done' => (
          bg: AppColors.secondary.withValues(alpha: 0.12),
          fg: AppColors.secondary,
          label: 'Completed'
        ),
      'on_hold' => (
          bg: AppColors.textSecondary.withValues(alpha: 0.14),
          fg: AppColors.textSecondary,
          label: 'On hold'
        ),
      'rejected' => (
          bg: AppColors.error.withValues(alpha: 0.12),
          fg: AppColors.error,
          label: 'Cancelled'
        ),
      _ => (
          bg: AppColors.primary.withValues(alpha: 0.12),
          fg: AppColors.primary,
          label: 'Upcoming'
        ),
    };

class MyAppointmentsScreen extends StatefulWidget {
  const MyAppointmentsScreen({super.key});

  @override
  State<MyAppointmentsScreen> createState() => _MyAppointmentsScreenState();
}

class _MyAppointmentsScreenState extends State<MyAppointmentsScreen> {
  Future<List<PatientAppointment>>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= PatientAuthScope.of(context).api.myAppointments();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = PatientAuthScope.of(context).api.myAppointments();
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final auth = PatientAuthScope.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('My visits'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await auth.logout();
              if (context.mounted) Navigator.of(context).pop();
            },
          ),
        ],
      ),
      body: FutureBuilder<List<PatientAppointment>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const StateView(loading: true);
          }
          if (snap.hasError) {
            return StateView(
                error: 'Could not load your visits.', onRetry: _refresh);
          }
          final list = snap.data ?? [];
          if (list.isEmpty) {
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(children: const [
                SizedBox(height: 120),
                StateView(empty: 'You have not booked any appointments yet.'),
              ]),
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) => _Row(
                appointment: list[i],
                onTap: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => PatientAppointmentDetailScreen(
                          appointmentId: list[i].id),
                    ),
                  );
                  _refresh();
                },
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final PatientAppointment appointment;
  final VoidCallback onTap;
  const _Row({required this.appointment, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final a = appointment;
    final s = statusStyle(a.consultationStatus);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: SectionCard(
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(a.doctorName ?? 'Doctor',
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 15),
                            overflow: TextOverflow.ellipsis),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: s.bg,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(s.label,
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: s.fg)),
                      ),
                    ],
                  ),
                  if (a.doctorSpecialization != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Text(a.doctorSpecialization!,
                          style: const TextStyle(
                              color: AppColors.textSecondary, fontSize: 13)),
                    ),
                  if (a.clinicName != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Row(children: [
                        const Icon(Icons.business_outlined,
                            size: 13, color: AppColors.textSecondary),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(a.clinicName!,
                              style: const TextStyle(
                                  color: AppColors.textSecondary, fontSize: 13),
                              overflow: TextOverflow.ellipsis),
                        ),
                      ]),
                    ),
                  const SizedBox(height: 6),
                  Row(children: [
                    const Icon(Icons.calendar_today_outlined, size: 13),
                    const SizedBox(width: 5),
                    Text('${formatDay(a.appointmentDate)} · ${a.startTime}',
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w500)),
                  ]),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}
