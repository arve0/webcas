# Bruke kalkulatoren
Kalkulatoren fungerer ved at du skriver inn et uttrykk, og trykker så enter.

```js
1 + 1
````

Resultatet lagres som `_`, og kan brukes i neste kalkulasjon:

```js
_ * 10
```

Om du ønsker å lagre resultatet til et navn eller en bokstav, kan du skrive:

```js
x = 2000 * 33 / 11
```

Resultatet er nå lagret til `x`, som du kan bruke i neste kalkulasjon:

```js
x + x
```

Du kan bevege deg opp / ned med piltastene eller tab / shift+tab.
Enter setter inn en ny linje når du er på siste linje.

For å sette inn et nytt felt midt i en rekke av utregninger, flytt markøren til
starten av feltet og trykk enter.

For å slette et felt, trykk på hvisketasten mens feltet er tomt.

Operasjonene går steg-for-steg, så utregninger du gjør under en linje er ikke
tilgjengelig i linjen over:

```js
x = 10
y = 2 * x  // 2 * 10 = 20
x = 3
y = 2 * x  // 2 * 3 = 6
```

# Tall

## Desimaltall
Desimaltall skrives med punktum:

```js
2.1 + 3.3  // 5.5
```

## 10-er eksponent
Du kan skrive 10-er eksponent med e:

```js
5.6 * 10^3  // 5600
5.6e3       // 5600
```

# Regneoperasjonene

## Pluss og minus
Skrives med `+` og `-`. Du kan også bruke `()` for å gruppere utregninger:

```js
1 + (3 - 10) - 4  // -10
```

## Gange
Skrives med `*`:

```js
10 * 10  // 100
```

Du kan også bruke mellomrom dersom du regner med symboler:

```js
x = 10
y = 2
x y  // 20, samme som x * y
```

## Dele
Skrives med `/`:

```js
10 / 2
```

**OBS:** Dersom du skal dele på flere symbol, må du gruppere eller bruke flere `/`:

```js
x = 2
10 / x x    // 10 / x * x = 10
10 / (x x)  // 10 / (x * x) = 2.5
10 / x / x  // samme som over
```

Dette gjelder også enheter, som kan være litt overraskende:

```js
R = 8.314462175 J / K mol    // 8.314462175 (J mol) / K
R = 8.314462175 J / (K mol)  // 8.314462175 J / (K mol)
R = 8.314462175 J / K / mol  // 8.314462175 J / (K mol)
```

## Eksponent
Eksponent skrives med `^`:

```js
2^3  // 2 * 2 * 2 = 8
```

# Funksjoner
Du kan lage funksjoner slik som dette:

```js
f(x) = x^2
```

Bruk funksjonen slik som dette:

```js
f(2)  // 4
f(3)  // 9
```

Du kan også sende variabler til funksjonen:

```js
strekning = 2 meter
f(strekning)  // 4 meter^2
```

En funksjon kan inngå i en kalkulasjon:

```js
f(2) * 3  // 12
```

Funksjonen kan ta i mot flere symboler:

```js
f(x, y) = x^2 y^3
f(2, 3)  // 108
```

# Enheter
Enheter skrives etter tall. Når en variabel har enhet, vil også utregninger bli med riktig enhet:

```js
x = 10 m
t = 5 s
v = x / t  // 2 m/s
```

OBS! Det er mulig å lagre over en enhet. For eksempel:

```js
m = 10 kg   // 10 kg
v = 10 m/s  // 100 kg/s
```

Her blir altså `m` byttet ut med `10 kg`. Du kan unngå dette på to måter.

1. Definer motsatt rekkefølge:

  ```js
  v = 10 m/s  // 10 m/s
  m = 10 kg     // 10 kg
  ```

2. Bruk fullt navn på enhet:

  ```js
  m = 10 kg
  v = 10 meter/s
  ```

## Oversikt over enheter
I tabellen under finner du alle enhetene som kan brukes:

Type                | Enhet
------------------- | ---
Lengde              | meter (m), inch (in), foot (ft), yard (yd), mile (mi), link (li), rod (rd), chain (ch), angstrom, mil
Areal               | m2, sqin, sqft, sqyd, sqmi, sqrd, sqch, sqmil, acre, hectare
Volum               | m3, litre (l, L, lt, liter), cc, cuin, cuft, cuyd, teaspoon, tablespoon
Væskevolum          | minim (min), fluiddram (fldr), fluidounce (floz), gill (gi), cup (cp), pint (pt), quart (qt), gallon (gal), beerbarrel (bbl), oilbarrel (obl), hogshead, drop (gtt)
Vinkler             | rad (radian), deg (degree), grad (gradian), cycle, arcsec (arcsecond), arcmin (arcminute)
Tid                 | second (s, secs, seconds), minute (mins, minutes), hour (h, hr, hrs, hours), day (days), week (weeks), month (months), year (years), decade (decades), century (centuries), millennium (millennia)
Frekvens            | hertz (Hz)
Masse               | gram(g), tonne, ton, grain (gr), dram (dr), ounce (oz), poundmass (lbm, lb, lbs), hundredweight (cwt), stick, stone
Strøm               | ampere (A)
Temperatur          | kelvin (K), celsius (degC), fahrenheit (degF), rankine (degR)
Antall partikler    | mole (mol)
Lysstyrke           | candela (cd)
Kraft               | newton (N), dyne (dyn), poundforce (lbf), kip
Energi              | joule (J), erg, Wh, BTU, electronvolt (eV)
Effekt              | watt (W), hp
Trykk               | Pa, psi, atm, torr, bar, mmHg, mmH2O, cmH2O
Elektrisitet og magnetisme | ampere (A), coulomb (C), watt (W), volt (V), ohm, farad (F), weber (Wb), tesla (T), henry (H), siemens (S), electronvolt (eV)
Binær               | bit (b), byte (B)
