---
title: "Units and Measurement: Important Points and Traps"
type: key_points
chapter: c11.physics.units-and-measurement
order: 3
---

## Units

- There are **7** SI base units: m, kg, s, A, K, mol, cd. Radian and steradian are **not** base units; they are dimensionless.
- Temperature in SI is the **kelvin**. The degree Celsius is allowed in use, but it is not a base unit.
- Current (ampere) is a base quantity. **Charge** is derived: $[\mathrm{AT}]$, unit coulomb = A s.

:::trap
Look-alike units:
- **Light year** (in NCERT) and **parsec** (exam extra) measure distance, not time.
- **Electron volt** (eV) measures energy: $1\text{ eV} = 1.6 \times 10^{-19}$ J.
- **kWh** measures energy, not power: $1\text{ kWh} = 3.6 \times 10^6$ J.
:::

:::trap
Write units correctly: "kg" not "Kg", "s" not "sec", "10 kg" not "10 kgs", "K" not "°K". A capital or small letter can change the meaning: mm is a millimetre, but Mm is a megametre.
:::

## Significant figures

:::remember
Significant figures = the digits known reliably **plus the first uncertain digit**.
:::

- Leading zeros are **never** significant: 0.00450 has 3 (4, 5, 0).
- Zeros between digits always are: 30.05 has 4.
- Trailing zeros count **only if there is a decimal point**: 4500 has 2 (NCERT rule), but 4500. and 4.500 have 4.

:::trap
A number like 4500 m is ambiguous. If all four digits were measured, write it as $4.500 \times 10^3$ m. The power of 10 never adds significant figures.
:::

:::trap
Don't mix up the two rules:
- × and ÷ → count **significant figures**;
- + and − → count **decimal places**.

$1.2 + 0.0345 = 1.2345$, written as **1.2** (1 decimal place). But $1.2 \times 0.0345 = 0.0414$, written as **0.041** (2 significant figures).
:::

- Changing units (cm to m) never changes the number of significant figures.
- Exact numbers (counted items, the 2 in $2\pi r$, the $\tfrac12$ in $\tfrac12mv^2$) don't limit the significant figures of the answer.
- Round only the final answer. Keep one extra digit in middle steps.

:::trap
Order of magnitude: NCERT rounds $a$ down to 1 if $a \le 5$ and up to 10 if $a > 5$. So $4.9 \times 10^5$ is of order $10^5$. Some other books switch at $\sqrt{10} \approx 3.16$ instead. Follow NCERT unless a question states its own rule.
:::

:::tip
**Rounding a 5 (NCERT): "even stays, odd goes up."** 4.65 → 4.6 (6 is even), 4.75 → 4.8 (7 is odd). This applies only when the dropped part is exactly 5.
:::

## Dimensions

:::remember
- A dimensionally wrong equation is **surely wrong**.
- A dimensionally correct equation **may still be wrong** (a wrong number or a missing term).
- Dimensionless constants like $2\pi$ or $\tfrac12$ can't be found by dimensional analysis.
:::

- Quantities with the **same dimensions** (to learn as pairs):
  - work, energy, torque: $[\mathrm{ML^2T^{-2}}]$;
  - pressure, stress, Young's modulus, energy per unit volume: $[\mathrm{ML^{-1}T^{-2}}]$;
  - angular momentum and Planck's constant: $[\mathrm{ML^2T^{-1}}]$;
  - impulse and momentum: $[\mathrm{MLT^{-1}}]$;
  - surface tension, spring constant, surface energy per unit area: $[\mathrm{MT^{-2}}]$;
  - frequency, angular velocity, velocity gradient: $[\mathrm{T^{-1}}]$.
- Some combinations worth knowing:
  - $\sqrt{l/g}$, $RC$, $L/R$ and $\sqrt{LC}$ all have the dimension of **time**;
  - $1/\sqrt{\mu_0\varepsilon_0}$ and $E/B$ have the dimension of **speed**;
  - $h\nu$, $k_BT$, $qV$ and $PV$ have the dimension of **energy**.

:::trap
Unit and dimension are different things:
- angle and solid angle have a **unit** (rad, sr) but **no dimensions**;
- strain, refractive index and relative density have **neither**;
- any quantity that has dimensions **must** have a unit.
:::

:::trap
In $y = A\sin(\omega t - kx)$, the bracket must be dimensionless. So $[\omega] = [\mathrm{T^{-1}}]$ and $[k] = [\mathrm{L^{-1}}]$. The same holds inside $\log$ and $e^{x}$, and for any exponent.
:::

:::tip
To find the dimensions of an unknown constant, make it match what it is added to. In $(P + \tfrac{a}{V^2})$, $\tfrac{a}{V^2}$ must have the dimensions of pressure, so $[a] = [P][V^2]$.
:::

- Two quantities can be **multiplied or divided** whatever their dimensions. Only adding, subtracting and equating need the same dimensions.

## Errors (mostly exam extra)

In the current NCERT: precision depends on the least count, relative error, and percentage errors adding in a product. The rest is exam extra.

:::trap
For $Z = A - B$, the errors still **add**: $\Delta Z = \Delta A + \Delta B$. The relative error of a difference can be huge when $A$ and $B$ are close.
:::

:::trap
For $Z = A/B$, the relative errors **add**: $\dfrac{\Delta Z}{Z} = \dfrac{\Delta A}{A} + \dfrac{\Delta B}{B}$. Never subtract them.
:::

- Powers multiply the error: in $g = \dfrac{4\pi^2 l}{T^2}$, the error in $T$ counts **twice**. The quantity with the highest power is the one to measure most carefully.
- $\pi$, $4\pi^2$ and other exact constants carry no error.
- Taking the mean of many readings reduces **random** error, but **not** systematic error.
- **Accuracy** = closeness to the true value. **Precision** = closeness of repeated readings to each other (fineness of the instrument). A result can be precise but not accurate.

:::trap
Zero error has a **sign**. True value = reading − zero error. With a negative zero error, you end up **adding** its size.
:::

:::tip
Least count: vernier = 1 MSD − 1 VSD; screw gauge = pitch ÷ number of circular divisions. Smaller least count means a more precise instrument.
:::

## NCERT lines to know

:::remember
- The units of the base quantities are called fundamental or base units; the units of all other quantities are derived units.
- The dimensions of a physical quantity are the powers to which the base quantities are raised to represent it.
- Only quantities with the same dimensions can be added or subtracted.
- Choosing a different unit does not change the number of significant figures.
:::
