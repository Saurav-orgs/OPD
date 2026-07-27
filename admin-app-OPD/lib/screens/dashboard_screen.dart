import 'package:flutter/material.dart';
import '../api/models.dart';
import '../auth/auth_scope.dart';
import '../theme.dart';
import '../widgets/common.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<(DashboardSummary, int)> _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future = _load();
  }

  Future<(DashboardSummary, int)> _load() async {
    final auth = AuthScope.of(context);
    final summary = await auth.api.dashboard();
    // Active-doctor count is only fetched if the role can read doctors.
    var enabled = 0;
    if (auth.can('doctors', 'read')) {
      final docs = await auth.api.listDoctors();
      enabled = docs.where((d) => d.isEnabled).length;
    }
    return (summary, enabled);
  }

  Future<void> _refresh() async {
    setState(() { _future = _load(); });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthScope.of(context).user;
    return FutureBuilder<(DashboardSummary, int)>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const StateView(loading: true);
        }
        if (snap.hasError) {
          return StateView(
              error: 'Could not load the dashboard.', onRetry: _refresh);
        }
        final (data, enabledDoctors) = snap.data!;
        final hour = DateTime.now().hour;
        final greeting = hour < 12
            ? 'Good morning'
            : hour < 17
                ? 'Good afternoon'
                : 'Good evening';
        final firstName = (user?.name ?? '').split(' ').first;

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _Hero(
                title: '$greeting, $firstName 👋',
                subtitle: "Here's what's happening today · ${data.date}",
              ),
              const SizedBox(height: 16),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.5,
                children: [
                  _Tile(
                      accent: AppColors.primary,
                      icon: Icons.event_note_outlined,
                      num: data.total,
                      label: "Today's appointments"),
                  _Tile(
                      accent: AppColors.secondary,
                      icon: Icons.check_circle_outline,
                      num: data.status('done'),
                      label: 'Consultations done'),
                  _Tile(
                      accent: AppColors.onHold,
                      icon: Icons.pause_circle_outline,
                      num: data.status('on_hold'),
                      label: 'On hold'),
                  _Tile(
                      accent: AppColors.booked,
                      icon: Icons.medical_services_outlined,
                      num: enabledDoctors,
                      label: 'Active doctors'),
                ],
              ),
              const SizedBox(height: 16),
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const CardTitle('By doctor · today'),
                    if (data.byDoctor.isEmpty)
                      const Text('No appointments today.',
                          style: TextStyle(color: AppColors.textSecondary))
                    else
                      ...data.byDoctor.map((d) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(child: Text(d.name)),
                                StatusBadge('info', label: '${d.count}'),
                              ],
                            ),
                          )),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const CardTitle("Today's schedule"),
                    if (data.appointments.isEmpty)
                      const Text('Nothing booked for today.',
                          style: TextStyle(color: AppColors.textSecondary))
                    else
                      ...data.appointments.map((a) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              children: [
                                SizedBox(
                                  width: 52,
                                  child: Text(a.startTime,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w500)),
                                ),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(a.patientName),
                                      Text(a.patientMobile,
                                          style: const TextStyle(
                                              color: AppColors.textSecondary,
                                              fontSize: 12)),
                                    ],
                                  ),
                                ),
                                StatusBadge(a.consultationStatus),
                              ],
                            ),
                          )),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Hero extends StatelessWidget {
  final String title;
  final String subtitle;
  const _Hero({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.card),
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryHover],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(subtitle,
              style: const TextStyle(color: Colors.white70, fontSize: 13)),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final Color accent;
  final IconData icon;
  final int num;
  final String label;
  const _Tile({
    required this.accent,
    required this.icon,
    required this.num,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(width: 4, height: 40, color: accent),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  children: [
                    Icon(icon, size: 16, color: AppColors.textSecondary),
                    const Spacer(),
                    Text('$num',
                        style: const TextStyle(
                            fontSize: 24, fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 4),
                Text(label,
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
