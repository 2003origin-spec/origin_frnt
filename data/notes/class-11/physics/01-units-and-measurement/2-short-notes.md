---
title: "Units and Measurement: Short Notes"
type: short_notes
chapter: c11.physics.units-and-measurement
order: 2
---

## 1. Units

- **Measurement** means comparing a physical quantity with a fixed, accepted standard called a **unit**.
- A measured value = (number) × (unit), for example 5 m. Both parts are needed.
- **Fundamental (base) units:** units of the base quantities. They are chosen, not built from other units.
- **Derived units:** built from base units, for example m/s for speed and kg m s⁻² (newton) for force.
- The base units together with the derived units form a **system of units**.

| System | Length | Mass | Time |
| --- | --- | --- | --- |
| CGS | centimetre | gram | second |
| FPS | foot | pound | second |
| MKS | metre | kilogram | second |

## 2. The SI system

The **Système International d'Unités (SI)** is the system used in science today. It has **seven base units**:

| Quantity | Unit (symbol) |
| --- | --- |
| Length | metre (m) |
| Mass | kilogram (kg) |
| Time | second (s) |
| Electric current | ampere (A) |
| Temperature | kelvin (K) |
| Amount of substance | mole (mol) |
| Luminous intensity | candela (cd) |

NCERT (Table 1.1) uses the **revised SI** (agreed in November 2018, in use from May 2019). Each base unit is now defined by fixing the exact value of a constant of nature:

| Unit | Fixed by |
| --- | --- |
| second | caesium-133 frequency $= 9192631770$ Hz |
| metre | speed of light $c = 299792458$ m/s |
| kilogram | Planck constant $h = 6.62607015 \times 10^{-34}$ J s |
| ampere | charge $e = 1.602176634 \times 10^{-19}$ C |
| kelvin | Boltzmann constant $k = 1.380649 \times 10^{-23}$ J/K |
| mole | $N_A = 6.02214076 \times 10^{23}$ mol⁻¹ |
| candela | luminous efficacy 683 lm/W at $540 \times 10^{12}$ Hz |

NCERT says these numbers need not be memorised. Know **which constant fixes which unit**.

:::remember
The kilogram is the only SI base unit with a prefix ("kilo") in its name.
:::

**Two more units (dimensionless):**
- **Radian (rad)** for plane angle: $d\theta = ds/r$.
- **Steradian (sr)** for solid angle: $d\Omega = dA/r^2$.

Older books call these two the "supplementary units". They are ratios of lengths or of areas, so they have no dimensions.

**Writing SI units correctly:**
- Symbols are never made plural and take no full stop: 10 kg, not 10 kgs.
- A unit named after a person has a capital symbol (N, Pa, J) but is written in small letters in full (newton, pascal, joule).
- Temperature is written in kelvin, K, not "°K".

## 3. Prefixes and handy units

| Prefix | Symbol | Power |
| --- | --- | --- |
| tera | T | $10^{12}$ |
| giga | G | $10^{9}$ |
| mega | M | $10^{6}$ |
| kilo | k | $10^{3}$ |
| centi | c | $10^{-2}$ |
| milli | m | $10^{-3}$ |
| micro | μ | $10^{-6}$ |
| nano | n | $10^{-9}$ |
| pico | p | $10^{-12}$ |
| femto | f | $10^{-15}$ |

**Non-SI units still in use (NCERT Table 1.2):** minute, hour, day, year (365.25 d), degree ($1^\circ = \pi/180$ rad), litre (1 L = $10^{-3}$ m³), tonne ($10^3$ kg), bar ($10^5$ Pa), barn ($10^{-28}$ m²), hectare ($10^4$ m²) and atm ($1.013 \times 10^5$ Pa).

**Length units for very small and very large distances:**
- 1 ångström = 1 Å = $10^{-10}$ m (size of an atom; NCERT Exercise 1.14).
- 1 light year = distance light travels in one year. NCERT works it out as $9.47 \times 10^{15}$ m, using $c = 3.00 \times 10^8$ m/s and 1 y = 365.25 d. Many books quote $9.46 \times 10^{15}$ m, which uses the exact value of $c$.
- 1 fermi = 1 fm = $10^{-15}$ m (about the size of a nucleus; exam extra).
- 1 astronomical unit (AU) $\approx 1.496 \times 10^{11}$ m, the mean Earth–Sun distance (exam extra).
- 1 parsec $\approx 3.08 \times 10^{16}$ m $\approx 3.26$ light years (exam extra, not in the current NCERT).

:::trap
A light year is a unit of **distance**, not of time.
:::

## 4. Significant figures

Every measurement has some uncertainty. A result shows the digits that are known reliably **plus the first uncertain digit**. These are the **significant figures**.

Example: a length written as 287.5 cm has 4 significant figures. The digits 2, 8, 7 are certain and 5 is uncertain.

**Counting rules (NCERT):**
1. All non-zero digits are significant.
2. Zeros **between** non-zero digits are significant: 2.308 has 4.
3. In a number less than 1, zeros after the decimal point but **before** the first non-zero digit are **not** significant: 0.002308 has 4.
4. Trailing zeros in a number **without** a decimal point are **not** significant: 123 m = 12300 cm = 123000 mm, all with 3.
5. Trailing zeros in a number **with** a decimal point **are** significant: 3.500 and 0.06900 both have 4.

:::remember
Changing the unit does **not** change the number of significant figures. 2.308 cm = 23.08 mm = 0.02308 m: each has 4.
:::

**Scientific notation removes the confusion.** Write the number as $a \times 10^b$ with $1 \le a < 10$. All digits in $a$ are significant. So 4.700 m = $4.700 \times 10^2$ cm (4 significant figures), while $4.7 \times 10^2$ cm has only 2.

**Exact numbers** (like the 2 in $2\pi r$, or a count of 5 students) have an unlimited number of significant figures.

**Order of magnitude:** round $a$ to 1 if $a \le 5$, or to 10 if $5 < a < 10$. The power of 10 you get is the order of magnitude. Example: $3.2 \times 10^6$ is of order $10^6$, and $7.8 \times 10^6$ is of order $10^7$.

## 5. Calculating with significant figures

| Operation | Keep in the answer |
| --- | --- |
| × or ÷ | the **least number of significant figures** among the numbers used |
| + or − | the **least number of decimal places** among the numbers used |

:::example{title="Both rules"}
$2.5 \times 1.25 = 3.125$, written as **3.1** (2.5 has only 2 significant figures).

$12.11 + 18.0 + 1.012 = 31.122$, written as **31.1** (18.0 has only 1 decimal place).
:::

**Rounding off (NCERT):**
- Dropped digit more than 5: raise the digit before it by 1 (2.746 → 2.75).
- Dropped digit less than 5: leave the digit before it as it is (2.743 → 2.74).
- Dropped digit **exactly 5**: if the digit before it is **even**, leave it (2.745 → 2.74); if it is **odd**, raise it by 1 (2.735 → 2.74).

In a long calculation, keep **one extra digit** in the middle steps, and round only the final answer.

**Uncertainty in the result (NCERT ideas):**
- A result can't be more precise than the data. If data has $n$ significant figures, the result is valid to $n$ significant figures. **Exception:** subtraction can lower it: $12.9 - 7.06$ is $5.8$ g, not $5.84$ g.
- When two measured values are **multiplied**, their **percentage** errors add. NCERT: $l = 16.2$ cm $\pm 0.6\%$ and $b = 10.1$ cm $\pm 1\%$, so $lb = 164 \pm 3$ cm² ($\pm 1.6\%$).
- The relative error depends on the number itself, not only on its significant figures. Both 1.02 and 9.89 have 3 significant figures, but an uncertainty of ±0.01 is about 1% of 1.02 and only about 0.1% of 9.89.

## 6. Dimensions

The **dimensions** of a quantity are the powers to which the base quantities must be raised to represent it.

- Base quantities in mechanics: mass [M], length [L], time [T]. Also current [A], temperature [K], amount of substance [mol], luminous intensity [cd].
- **Dimensional formula:** for example, force has the dimensional formula $[\mathrm{MLT^{-2}}]$. Its dimensions are 1 in mass, 1 in length and −2 in time.
- **Dimensional equation:** an equation such as $[F] = [\mathrm{MLT^{-2}}]$ or $[V] = [\mathrm{M^0L^3T^0}]$.
- Square brackets [ ] mean "the dimensions of".

**How to find one:** write a defining formula and replace each quantity by its dimensions.

:::example{title="Pressure"}
$P = \dfrac{F}{A}$, so $[P] = \dfrac{[\mathrm{MLT^{-2}}]}{[\mathrm{L^2}]} = [\mathrm{ML^{-1}T^{-2}}]$.
:::

## 7. Dimensional analysis

**(a) Checking an equation (principle of homogeneity).** Every term added, subtracted or equated must have the same dimensions. In $x = x_0 + v_0t + \tfrac12at^2$ every term is $[\mathrm{L}]$, so it is consistent.

- A dimensionally **wrong** equation is surely wrong.
- A dimensionally **right** equation is not surely right. Dimensions can't catch a wrong number like $\tfrac12$ in place of 1.
- Arguments of $\sin$, $\cos$, $\log$ and $e^x$ (and powers like the $n$ in $x^n$) must be dimensionless.

**(b) Deducing a relation.** Guess that the quantity is a product of powers of what it depends on, then match the powers of M, L, T.

:::example{title="Simple pendulum"}
Let the period $T$ depend on length $l$, mass $m$ and $g$: $T = k\,l^x m^y g^z$.

Dimensions: $[\mathrm{T}] = [\mathrm{L}]^x[\mathrm{M}]^y[\mathrm{LT^{-2}}]^z$.

M: $y = 0$. T: $-2z = 1$, so $z = -\tfrac12$. L: $x + z = 0$, so $x = \tfrac12$.

So $T = k\sqrt{l/g}$. The constant $k$ ($= 2\pi$) must come from experiment or theory.
:::

**(c) Converting units (NCERT Exercises 1.2 and 1.3).** The size of a quantity doesn't change, so $n_1u_1 = n_2u_2$. Put the dimensions in to find $n_2$. For example, a joule is 1 kg m² s⁻², and 1 kg = 1000 g, 1 m = 100 cm, so 1 J = $1000 \times 100^2$ g cm² s⁻² $= 10^7$ erg.

**Limits of dimensional analysis:**
- It can't find dimensionless constants ($2\pi$, $\tfrac12$).
- It can't find relations with $\sin$, $\log$ or $e^x$, or with a sum of terms.
- It can't tell apart quantities with the same dimensions (work and torque).
- With only M, L, T it can find a relation among at most 3 other quantities.

## 8. Errors in measurement (mostly exam extra)

The current NCERT keeps only a little of this: significant figures show the **precision**, which depends on the **least count** of the instrument; relative error; and percentage errors adding in a product (Section 5 above). The rest of this section was in the deleted part of the chapter. JEE Main and NEET still list "errors in measurement" and "least count" in their syllabus.

| Term | Meaning |
| --- | --- |
| Accuracy | How close a result is to the **true** value |
| Precision | How close repeated results are to **each other** (the resolution of the instrument) |
| Least count | The smallest value an instrument can measure |

- **Systematic errors** push all readings the same way. Causes: a faulty instrument (zero error), a poor method (imperfect technique), or personal habits (parallax). They are reduced by better instruments and methods, and a known one (like a zero error) can be corrected. Repeating readings does **not** reduce them.
- **Random errors** are irregular, changing in size and sign. They are reduced by taking **many readings** and using the mean.
- **Least count error** comes from the instrument's resolution. A better instrument (smaller least count) reduces it.

:::example{title="Accurate vs precise"}
True length 5.47 cm. Instrument P (least count 0.1 cm) reads 5.5 cm. Instrument Q (least count 0.01 cm) reads 5.38 cm. P is more **accurate**; Q is more **precise**.
:::

**Combining errors (exam extra, except the product rule):** for a sum or difference, add the **absolute** errors. For a product, quotient or power, add the **relative** (or percentage) errors, each times its power.
