[Documentation index](../../README.md)

# 5. Technische Verträge vor der Fahrzeugentwicklung

### 5.1 API-/Backend-/Plattform-Matrix (`docs/API_COMPATIBILITY.md`)

Für jede benötigte Operation die Spalten führen:

`Funktion | exakte Defold-API/Signatur | Quelle/Ref-Version | gewählter Backend | Windows Debug | HTML5 | Android Debug | erwartete Semantik | Test-ID | Ergebnis | Einschränkung`

**G1 Pflicht-PoC:**
- Tatsächlich aktiviertes Box2D 3 (`b2d.get_version()` oder geeigneter verified Runtime-Nachweis).
- Dynamics/Static-Body, Collision, Wheel Joint **mit Spring + Motor**, sichere Erstellung/Zerstörung.
- Sichere Reset-Operation und valide Handles vor/nach Reset.
- Verfügbare Kollisionsgruppen/-Masken, Sensor-/Kontaktwege klären.

**G4a Pflicht:** Terrain-/Edge-/Chain-Option, Filterung, hoher Speed/CCD, Kontaktverhalten und mobile Plattformtests nachweisen. Fehlende Pflicht-API → Gate **FAIL/BLOCKED**, Alternativen dokumentieren, Entscheidung anfordern. Kein eigenes Box2D heimlich einbauen.
