[Documentation index](../README.md)

# 7. Spielverträge für den ersten Buggy

### 7.1 Steuerung

Normalisierter Tick-Command, beispielsweise:

```text
vehicle_command = {
  throttle: 0..1,
  brake_reverse: 0..1,
  lean: -1..1
}
```

Die finalen Feldnamen dürfen Lua-sinnvoll gewählt werden. Regeln:
- Eingabequelle (Touch, Tastatur, später Gamepad) kennt das Fahrzeug nicht.
- Gas, Bremse/Rückwärtsfahrt und Neigung links/rechts sind eigenständige Aktionen.
- Default bei **Gas + Bremse gleichzeitig**: Bremse gewinnt (oder eindeutig dokumentierte andere Regel); Verhalten durch Test fixieren.
- Bremse und Reverse klar trennen: zunächst abbremsen bis nahezu Stillstand, erst dann kontrolliert rückwärts antreiben; Grenzgeschwindigkeit/-hysterese abstimmen.
- Touch-ID einmalig einem Button/Steuerbereich zuordnen; Release außerhalb, Fokusverlust, Touch-Cancel, Orientation Change und Szenariowechsel müssen Input loslassen.
- GUI-Panels dürfen keine versteckten Fahrzeuginputs erzeugen.

### 7.2 Motor-/Fahrverhalten

Explizite Werte für `motor_target_angular_speed`, `max_motor_torque`, erlaubte Fahrzeuggeschwindigkeit/-Limitierung, Bremsmoment, Fahrhilfe-Drehmoment, Federfrequenz und Dämpfung. **Ziel-Raddrehzahl ist nicht automatisch tatsächliche Fahrzeuggeschwindigkeit.** Test bei unterschiedlicher Masse, Reifenreibung, Bergauf/Bergab und in der Luft.

### 7.3 Failure, Retry und Kamera

- Fail-Merkmale vorab definieren: z.B. Crash-/Orientierungsfenster, Chassis-Bodenkontakt, definierter Sensor, außerhalb der Strecke oder keine Fortschrittsmöglichkeit; keine ungetestete „jeder Überschlag ist verloren“-Regel.
- Retry in kurzer Zeit, setzt vollständig zurück: Fahrzeug, dynamische Hindernisse, Input, Timer, Partikel (falls vorhanden), Kamera und Versuchsdaten.
- Checkpoints zunächst **nicht** implementieren, sofern die erste kurze Challenge sie nicht benötigt.
- Kamera: weiche Fahrzeugverfolgung, vorausschauender Blick, gute Sicht auf Landezone; prüfen bei Links-/Rückwärtsbewegung, hoher Geschwindigkeit und unterschiedlichem Seitenverhältnis.

### 7.4 Erste Challenge = Spielspaß-Gate

30–60 Sekunden, drei Stellen: dosiertes Gas / Bremsen, kurzer kontrollierter Sprung und ein Hindernis, das richtige Neigung oder Timing verlangt. Dauerhaftes Volllastfahren muss **mindestens eine** Passage nachvollziehbar scheitern lassen; geschicktes Spielen muss sie bestehen können. Direktes Retry nach Fehler; noch keine Medaillen-/Ökonomieproduktion.

Abnahme durch Mensch: „verständlich, kontrollierbar, wiederholbar, macht weitere Versuche interessant“. Diese subjektive Abnahme ist **separat** von automatischen technischen Tests festzuhalten.

G5 protokolliert je Kriterium Beobachtung, Problem und Entscheidung:

| Kriterium | Erwartete Beobachtung |
|---|---|
| Steuerbarkeit | Geschwindigkeit und Neigung lassen sich gezielt beeinflussen |
| Federung/Landung | Reaktionen sind nachvollziehbar und wiederholbar |
| Lesbarkeit/Fairness | Hindernis und Fehlerursache erkennbar; Erfolg nicht von verdecktem Zufall abhängig |
| Herausforderung | Gezielte Bedienung löst die Passage zuverlässig; Vollgas-Scheitern allein genügt nicht als Qualitätsbeleg |
| Retry | Erneuter Versuch ohne störende Wartezeit; gemessene Retry-Dauer dokumentieren |
| Mobile | Gleichzeitige Touchaktionen ohne unbeabsichtigte Eingaben |
| Motivation | Tester möchte misslungene Passagen erneut versuchen; Gründe notieren |

Desktop und echtes Touch-Gerät prüfen. Testerzahl, Gerät und Beobachtungen nennen; eine zusätzliche kleine Testgruppe ist optional. Einzelne subjektive Abnahme nicht als allgemeiner Nachweis für alle Spieler darstellen.

---
