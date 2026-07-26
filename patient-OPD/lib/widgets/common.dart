import 'package:flutter/material.dart';
import '../theme.dart';

/// Rounded network image with graceful loading + fallback.
class NetworkAvatar extends StatelessWidget {
  final String? url;
  final double size;
  final IconData fallback;
  const NetworkAvatar({
    super.key,
    required this.url,
    this.size = 56,
    this.fallback = Icons.person,
  });

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.primaryTint,
        borderRadius: BorderRadius.circular(size / 4),
      ),
      child: Icon(fallback, color: AppColors.primary, size: size * 0.5),
    );
    if (url == null || url!.isEmpty) return placeholder;
    return ClipRRect(
      borderRadius: BorderRadius.circular(size / 4),
      child: Image.network(
        url!,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => placeholder,
        loadingBuilder: (c, child, progress) =>
            progress == null ? child : placeholder,
      ),
    );
  }
}

/// A soft-outlined section card matching the Calm Clinical look.
class SectionCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  const SectionCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: child,
    );
  }
}

/// Full-screen state (loading / error / empty).
class StateView extends StatelessWidget {
  final bool loading;
  final String? error;
  final VoidCallback? onRetry;
  final String? empty;
  const StateView({super.key, this.loading = false, this.error, this.onRetry, this.empty});

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    }
    if (error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 40),
              const SizedBox(height: 12),
              Text(error!, textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textSecondary)),
              if (onRetry != null) ...[
                const SizedBox(height: 16),
                OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
              ],
            ],
          ),
        ),
      );
    }
    return Center(
      child: Text(empty ?? 'Nothing here yet.',
          style: const TextStyle(color: AppColors.textSecondary)),
    );
  }
}

void showErrorSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: AppColors.error,
      behavior: SnackBarBehavior.floating,
    ));
}
