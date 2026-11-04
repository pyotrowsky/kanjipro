# Prywatny import audio z Anki (.apkg) — MVP

Import jest dostępny w **Ustawienia → Nagrania z Anki (prywatne)**.

1. Wyeksportuj talię ze słówkami w Anki jako **Deck package (.apkg)**.
2. Zaznacz **Include media / Dołącz multimedia** oraz **Support older Anki versions / Obsługuj starsze wersje Anki**. Ta druga opcja jest ważna: obecny importer rozumie starszą bazę SQLite (`collection.anki21` / `collection.anki2`), ale nie nowy format `collection.anki21b` (zstd + protobuf). Nowy format jest wykrywany i odrzucany, żeby nie pomylić go z atrapą `collection.anki2`.
3. Zapisz plik w aplikacji **Pliki** (iOS/iPadOS) lub w menedżerze plików Androida.
4. Otwórz Kanji.pro i wybierz plik w ustawieniach. Podczas pierwszego importu potrzebny jest internet, ponieważ biblioteki ZIP i SQLite są pobierane na żądanie.
5. Import dopasuje słówka na podstawie identyfikatora notatki Anki; jeśli go brak, na podstawie jednoznacznej pary zapis + odczyt. Słówka: `AudioDictionary`, potem `Audio`. Osobne nagrania odczytów kanji: `AudioOnyomi` (także `AudioOn`) i `AudioKunyomi` (także `AudioKun`).
6. Zaimportowane nagrania mają przycisk odsłuchu w szczegółach słówka i na pytaniach quizu. W quizie przycisk odsłuchu pojawia się dopiero **po sprawdzeniu odpowiedzi**. Odczyty ON/KUN mają osobne przyciski w szczegółach kanji. Odtwarzanie po imporcie działa offline.

## Prywatność i prawa

Audio zapisuje się jako `Blob` w oddzielnej lokalnej bazie IndexedDB `wsjj-kanji-pro-private-audio`. Nie jest publikowane w repozytorium ani synchronizowane przez Firebase; usuwa się je przyciskiem w ustawieniach lub czyszcząc dane witryny. Dane nauki i inne ustawienia pozostają nietknięte. Każdy powinien używać wyłącznie nagrań, do których ma uprawnienia; osobisty import nie udziela licencji na redystrybucję.

## Ograniczenia MVP

- Brak sztywnego limitu wielkości całego pakietu `.apkg`. Archiwum odczytywane jest z lokalnego pliku, ale wypakowywane są tylko nagrania dopasowane do słówek Kanji.pro. GIF-y, obrazy, wideo i inne media są ignorowane. Maksymalny rozmiar pojedynczego nagrania to 8 MB.
- Duży eksport może nadal przekroczyć pamięć przeglądarki (zwłaszcza na iOS), limit lokalnej pamięci IndexedDB lub możliwości biblioteki SQLite. W takim przypadku wyeksportuj kilka mniejszych talii; importy można wykonywać po kolei.
- Obsługiwane: MP3, OGG/OGA, OPUS, WAV, M4A, AAC; na niektórych urządzeniach odtwarzanie konkretnego kodeka może nie być dostępne.
- Format `.anki21b` jest obsługiwany (Zstandard / Protobuf). Format `.colpkg` pozostaje poza zakresem importu talii.
- Pliki bez metadanych zgodnych z kolekcją Kanji.pro lub niejednoznaczne są pomijane.
- Lokalne nagrania nie przenoszą się automatycznie między urządzeniami: import wykonuje się na każdym urządzeniu osobno.
- Import jest świadomie uruchamiany ręcznie; biblioteki zewnętrzne: zip.js (BSD-3-Clause), sql.js (MIT), fzstd (MIT). Żadne pliki Anki nie są przesyłane do tych dostawców, ale pobierane są biblioteki z publicznych CDN.
