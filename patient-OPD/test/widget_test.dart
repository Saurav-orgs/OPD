// Smoke test: the app boots and shows the doctor-finder screen.
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_application_1/main.dart';

void main() {
  testWidgets('App boots to the doctor list screen', (WidgetTester tester) async {
    await tester.pumpWidget(const OpdApp());
    await tester.pump();
    expect(find.text('Find a doctor'), findsOneWidget);
  });
}
