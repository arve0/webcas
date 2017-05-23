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

Operasjonene går steg-for-steg, så utregninger du gjør under en linje er ikke
tilgjengelig i linjen over:

```js
x = 10
y = 2 * x
x = 2
```

## Regneoperasjonene

### Pluss og minus
Skrives med `+` og `-`. Du kan også bruke `()` for å gruppere utregninger:

```js
1 + (3 - 10) - 4
```

### Gange
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

### Dele
Skrives med `/`:

```js
10 / 2
```

**OBS:** Dersom du skal dele på flere symbol, må du gruppere eller bruke flere `/`:

```js
x = 2
10 / x x    // 10 / x * x = 10
10 / (x x)  // 10 / (x * x) = 0.1
10 / x / x  // samme som over
```

Dette gjelder også enheter, som kan være litt overraskende:

```js
R = 8.314462175 J / K mol    // 8.314462175 (J mol) / K
R = 8.314462175 J / (K mol)  // 8.314462175 J / (K mol)
R = 8.314462175 J / K / mol  // 8.314462175 J / (K mol)
```

# Funksjoner

# Enheter
Enheter skrives etter tall. Når en variabel har enhet, vil også utregninger bli med riktig enhet:

```js
x = 10 m
t = 5 s
v = x / t  // 2 m/s
```

OBS! Det er mulig å lagre over en enhet. For eksempel:

```js
m = 10 kg     // 10 kg
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
