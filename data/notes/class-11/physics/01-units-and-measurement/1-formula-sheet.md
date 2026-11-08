---
title: "Units and Measurement: Formula Sheet"
type: formula_sheet
chapter: c11.physics.units-and-measurement
order: 1
---

## SI base units

| Base quantity | SI unit | Symbol |
| --- | --- | --- |
| Length | metre | m |
| Mass | kilogram | kg |
| Time | second | s |
| Electric current | ampere | A |
| Thermodynamic temperature | kelvin | K |
| Amount of substance | mole | mol |
| Luminous intensity | candela | cd |

Their dimensions are written $[\mathrm{M}]$, $[\mathrm{L}]$, $[\mathrm{T}]$, $[\mathrm{A}]$, $[\mathrm{K}]$, $[\mathrm{mol}]$, $[\mathrm{cd}]$.

## Angles

:::formula{title="Plane angle (radian)"}
$$d\theta = \frac{ds}{r}$$
$ds$ = arc length, $r$ = radius. Unit: radian (rad). A full circle is $2\pi$ rad, and $1\text{ rad} \approx 57.3^\circ$.
:::

:::formula{title="Solid angle (steradian)"}
$$d\Omega = \frac{dA}{r^2}$$
$dA$ = area cut on a sphere of radius $r$. Unit: steradian (sr). A full sphere is $4\pi$ sr.

Both are ratios of like quantities, so they have a **unit but no dimensions**.
:::

## Significant figures (NCERT rules)

:::formula{title="Scientific notation"}
$$x = a \times 10^{b}, \quad 1 \le a < 10$$
All digits in $a$ are significant. The power of 10 is not counted.
:::

:::formula{title="Order of magnitude"}
$$x \approx 10^{b}\ \text{if}\ a \le 5$$
$$x \approx 10^{b+1}\ \text{if}\ 5 < a < 10$$
The order of magnitude is the power of 10 after this rounding (NCERT's rule).
:::

:::formula{title="Multiplying or dividing"}
Keep as many **significant figures** as the factor with the **fewest** significant figures.
$$\frac{4.237\ \text{g}}{2.51\ \text{cm}^3} = 1.69\ \text{g cm}^{-3}$$
:::

:::formula{title="Adding or subtracting"}
Keep as many **decimal places** as the number with the **fewest** decimal places.
$$436.32 + 227.2 + 0.301 = 663.8$$
The calculator shows 663.821; one decimal place is kept because 227.2 has only one.
:::

## Dimensions

:::formula{title="Dimensional formula"}
$$[Q] = [\mathrm{M}^a\,\mathrm{L}^b\,\mathrm{T}^c]$$
$a$, $b$, $c$ are the **dimensions** of $Q$ in mass, length and time. Add $[\mathrm{A}]$, $[\mathrm{K}]$, $[\mathrm{mol}]$ when needed.
:::

:::formula{title="Principle of homogeneity"}
$$[\text{each term}] = [\text{every other term}]$$
Only quantities with the same dimensions can be added, subtracted or equated. The argument of $\sin$, $\cos$, $\log$, $e^x$ must be **dimensionless**.
:::

:::formula{title="Deducing a relation"}
$$Q = k\,A^x B^y C^z$$
Equate the powers of M, L and T on both sides and solve for $x$, $y$, $z$. $k$ is a dimensionless constant that this method **cannot** find. Works only when $Q$ depends on a **product of powers**, and on at most 3 quantities (with M, L, T only).
:::

:::formula{title="Converting units"}
$$n_1 u_1 = n_2 u_2$$
$$\begin{aligned} n_2 = n_1 &\left[\frac{M_1}{M_2}\right]^a \\ &\times \left[\frac{L_1}{L_2}\right]^b \left[\frac{T_1}{T_2}\right]^c \end{aligned}$$
$n$ = numerical value, $u$ = unit, $[\mathrm{M}^a\mathrm{L}^b\mathrm{T}^c]$ = dimensions of the quantity. A bigger unit gives a smaller number.

Example: $1\text{ J} = 10^7\text{ erg}$ and $1\text{ N} = 10^5\text{ dyne}$. NCERT uses this method in Exercises 1.2 and 1.3 (treat units like algebraic symbols).
:::

## Dimensions to know

| Quantity | Dimensions | SI unit |
| --- | --- | --- |
| Force | $[\mathrm{MLT^{-2}}]$ | N |
| Work, energy, torque | $[\mathrm{ML^2T^{-2}}]$ | J, N m |
| Power | $[\mathrm{ML^2T^{-3}}]$ | W |
| Pressure, stress, modulus | $[\mathrm{ML^{-1}T^{-2}}]$ | Pa |
| Momentum, impulse | $[\mathrm{MLT^{-1}}]$ | kg m/s |
| Angular momentum, $h$ | $[\mathrm{ML^2T^{-1}}]$ | J s |
| $G$ | $[\mathrm{M^{-1}L^3T^{-2}}]$ | N m² kg⁻² |
| Surface tension, spring constant | $[\mathrm{MT^{-2}}]$ | N/m |
| Viscosity $\eta$ | $[\mathrm{ML^{-1}T^{-1}}]$ | Pa s |
| Frequency, $\omega$ | $[\mathrm{T^{-1}}]$ | Hz, rad/s |
| Specific heat | $[\mathrm{L^2T^{-2}K^{-1}}]$ | J kg⁻¹ K⁻¹ |
| Latent heat | $[\mathrm{L^2T^{-2}}]$ | J/kg |
| $k_B$ | $[\mathrm{ML^2T^{-2}K^{-1}}]$ | J/K |
| Gas constant $R$ | $[\mathrm{ML^2T^{-2}K^{-1}mol^{-1}}]$ | J mol⁻¹ K⁻¹ |

| Quantity (electric) | Dimensions | SI unit |
| --- | --- | --- |
| Charge | $[\mathrm{AT}]$ | C |
| Potential difference | $[\mathrm{ML^2T^{-3}A^{-1}}]$ | V |
| Resistance | $[\mathrm{ML^2T^{-3}A^{-2}}]$ | Ω |
| Capacitance | $[\mathrm{M^{-1}L^{-2}T^4A^2}]$ | F |
| Inductance | $[\mathrm{ML^2T^{-2}A^{-2}}]$ | H |
| Magnetic field $B$ | $[\mathrm{MT^{-2}A^{-1}}]$ | T |
| $\varepsilon_0$ | $[\mathrm{M^{-1}L^{-3}T^4A^2}]$ | F/m |
| $\mu_0$ | $[\mathrm{MLT^{-2}A^{-2}}]$ | H/m |

**Dimensionless:** strain, angle, refractive index, relative density, $\mu$ (friction).

## Errors in measurement

NCERT (Section 1.3.3) keeps only two ideas: **relative (percentage) error**, and that percentage errors **add** when measured values are multiplied (its example: $l = 16.2$ cm $\pm 0.6\%$, $b = 10.1$ cm $\pm 1\%$, so $lb$ has $\pm 1.6\%$). The mean absolute error and the general rules below are **exam extra**: they were in the deleted part of the chapter, but JEE Main and NEET still list "errors in measurement".

:::formula{title="Mean value and absolute error (exam extra)"}
$$a_{mean} = \frac{a_1 + a_2 + \dots + a_n}{n}$$
$$\Delta a_i = a_{mean} - a_i$$
$$\Delta a_{mean} = \frac{|\Delta a_1| + \dots + |\Delta a_n|}{n}$$
The result is written $a_{mean} \pm \Delta a_{mean}$.
:::

:::formula{title="Relative and percentage error"}
$$\delta a = \frac{\Delta a_{mean}}{a_{mean}}$$
Percentage error $= \delta a \times 100\%$. In NCERT's words: relative error = uncertainty ÷ value, so $1.02 \pm 0.01$ g has a relative error of about $\pm 1\%$. It has no unit.
:::

:::formula{title="Sum or difference (exam extra)"}
If $Z = A + B$ or $Z = A - B$:
$$\Delta Z = \Delta A + \Delta B$$
The **absolute** errors add, for a sum **and** for a difference.
:::

:::formula{title="Product, quotient and powers"}
$$Z = \frac{A^p B^q}{C^r}$$
$$\begin{aligned} \frac{\Delta Z}{Z} = {} &p\frac{\Delta A}{A} + q\frac{\Delta B}{B} \\ &+ r\frac{\Delta C}{C} \end{aligned}$$
The **relative** errors add, each multiplied by its power (NCERT shows only the plain product $Z = AB$; powers and quotients are exam extra). Every term is added, even for a power in the denominator. These give the **maximum** error and assume each error is small compared to its value.
:::

## Instruments (exam extra: NCERT only names them in Exercises 1.6 and 1.8)

:::formula{title="Vernier callipers"}
$$\text{LC} = 1\text{ MSD} - 1\text{ VSD}$$
MSD = main-scale division, VSD = vernier-scale division. If $N$ vernier divisions equal $(N-1)$ main-scale divisions, $\text{LC} = \dfrac{1\text{ MSD}}{N}$.
:::

:::formula{title="Screw gauge"}
$$\text{LC} = \frac{\text{pitch}}{\text{no. of circular divisions}}$$
Pitch = distance moved by the screw in one full turn.
:::

:::formula{title="Reading with zero error"}
$$\text{Reading} = \text{MSR} + n \times \text{LC}$$
$$\text{True value} = \text{Reading} - \text{zero error}$$
MSR = main-scale reading, $n$ = coinciding vernier division (or circular-scale division). Zero error keeps its sign. Subtracting a positive zero error lowers the reading; subtracting a negative one means you **add** its size.
:::
