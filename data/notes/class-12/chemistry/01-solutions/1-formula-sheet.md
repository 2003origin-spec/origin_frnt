---
title: "Solutions: Formula Sheet"
type: formula_sheet
chapter: c12.chemistry.solutions
order: 1
---

Subscript 1 = solvent, subscript 2 = solute (NCERT's convention). $w$ = mass in grams, $M$ = molar mass in g/mol, $n$ = moles.

## Concentration

:::formula{title="Mass percentage (w/w)"}
$$\text{Mass \%} = \frac{w_A}{w_{\text{solution}}} \times 100$$
$w_A$ = mass of component A. 10% glucose by mass: 10 g glucose in 90 g water (100 g of solution).
:::

:::formula{title="Volume percentage (V/V)"}
$$\text{Vol \%} = \frac{V_A}{V_{\text{solution}}} \times 100$$
$V_A$ = volume of component A. Mass by volume % (w/V) = grams of solute in 100 mL of **solution** (used in medicine; normal saline is 0.9% w/V NaCl).
:::

:::formula{title="Parts per million"}
$$\text{ppm} = \frac{\text{parts of A}}{\text{total parts}} \times 10^6$$
A = the component. Used for trace amounts. Can be mass/mass, volume/volume or mass/volume.
:::

:::formula{title="Mole fraction"}
$$x_A = \frac{n_A}{n_A + n_B}$$
$$x_1 + x_2 + \dots + x_i = 1$$
No unit.
:::

:::formula{title="Molarity"}
$$M = \frac{\text{moles of solute}}{\text{volume of solution in L}}$$
Unit: mol L⁻¹ (= mol dm⁻³), written M. It **changes with temperature**, because volume does.
:::

:::formula{title="Molality"}
$$m = \frac{\text{moles of solute}}{\text{mass of solvent in kg}}$$
$$m = \frac{1000 \times w_2}{M_2 \times w_1}$$
Unit: mol kg⁻¹, written m. Here $w_1$ = grams of **solvent** (not solution). Mass %, ppm, mole fraction and molality do **not** change with temperature.
:::

:::formula{title="Molarity to molality (exam extra)"}
$$m = \frac{1000\,M}{1000\,d - M M_2}$$
$M$ = molarity, $d$ = density of the solution in g/mL, $M_2$ = molar mass of solute. It comes straight from the definitions: 1 L of solution weighs $1000\,d$ g, of which $M M_2$ g is solute.
:::

## Henry's law (gas in a liquid)

:::formula{title="Henry's law"}
$$p = K_H\, x$$
$p$ = partial pressure of the gas above the solution, $x$ = mole fraction of the gas in the solution, $K_H$ = Henry's law constant (same unit as $p$; NCERT lists it in kbar).

Holds at constant temperature. **Higher $K_H$ means lower solubility.** $K_H$ rises with temperature, so gases dissolve less in warm water.

(Exam extra) It works best for dilute solutions at low pressure, for gases that do not react with or ionise in the solvent ($\ce{NH3}$ and $\ce{HCl}$ in water deviate).
:::

## Raoult's law (liquid solutions)

:::formula{title="Raoult's law"}
$$p_1 = x_1\, p_1^0$$
$p_1^0$ = vapour pressure of the pure component at the same temperature. Each **volatile** component obeys it in an ideal solution.
:::

:::formula{title="Total vapour pressure (two volatile liquids)"}
$$p_{total} = x_1 p_1^0 + x_2 p_2^0$$
$$p_{total} = p_1^0 + (p_2^0 - p_1^0)\, x_2$$
A straight line from $p_1^0$ (at $x_2 = 0$) to $p_2^0$ (at $x_2 = 1$). Ideal solution only. Raoult's law is a special case of Henry's law, with $K_H = p_1^0$.
:::

:::formula{title="Composition of the vapour (Dalton)"}
$$p_i = y_i\, p_{total}$$
$y_i$ = mole fraction in the **vapour**. For an ideal solution, the vapour is richer than the liquid in the more volatile component (the one with the larger $p^0$). This fails at an azeotrope, where the two compositions are equal.
:::

:::formula{title="Total pressure from vapour composition (exam extra)"}
$$\frac{1}{p_{total}} = \frac{y_1}{p_1^0} + \frac{y_2}{p_2^0}$$
Ideal solution. It follows from $x_i = y_i\,p_{total}/p_i^0$ and $x_1 + x_2 = 1$.
:::

## Ideal and non-ideal solutions

:::formula{title="Ideal solution"}
$$\Delta_{mix}H = 0$$
$$\Delta_{mix}V = 0$$
Obeys Raoult's law over the **whole** range of composition. A–B attractions are about equal to A–A and B–B.

(Exam extra, not in NCERT) Mixing is still spontaneous: $\Delta_{mix}S > 0$ and $\Delta_{mix}G < 0$.
:::

| Property | Ideal | Positive deviation | Negative deviation |
| --- | --- | --- | --- |
| Vapour pressure vs Raoult | Equal | Higher | Lower |
| A–B attractions | Same as A–A, B–B | Weaker | Stronger |
| $\Delta_{mix}H$ (NCERT Ex. 1.14) | 0 | > 0 | < 0 |
| $\Delta_{mix}V$ (exam extra) | 0 | > 0 | < 0 |
| Azeotrope (large deviation) | None | Minimum boiling | Maximum boiling |

## Colligative properties (dilute solution, non-volatile solute)

:::formula{title="Relative lowering of vapour pressure"}
$$\frac{p_1^0 - p_1}{p_1^0} = x_2$$
$$x_2 = \frac{n_2}{n_1 + n_2}$$
The relative lowering equals the mole fraction of the **solute**. For a dilute solution ($n_2 \ll n_1$):
$$\frac{p_1^0 - p_1}{p_1^0} \approx \frac{n_2}{n_1}$$
$$\frac{n_2}{n_1} = \frac{w_2 M_1}{M_2 w_1}$$
(Exam extra) Without any approximation, $\dfrac{p_1^0 - p_1}{p_1} = \dfrac{n_2}{n_1}$.
:::

:::formula{title="Elevation of boiling point"}
$$\Delta T_b = T_b - T_b^0$$
$$\Delta T_b = K_b\, m$$
$$M_2 = \frac{1000 \times w_2 \times K_b}{\Delta T_b \times w_1}$$
$K_b$ = molal elevation (ebullioscopic) constant, unit K kg mol⁻¹. It depends only on the solvent.
:::

:::formula{title="Depression of freezing point"}
$$\Delta T_f = T_f^0 - T_f$$
$$\Delta T_f = K_f\, m$$
$$M_2 = \frac{1000 \times w_2 \times K_f}{\Delta T_f \times w_1}$$
$K_f$ = molal depression (cryoscopic) constant, unit K kg mol⁻¹. Valid for dilute solutions where only pure solvent freezes out.
:::

:::formula{title="Kb and Kf from the solvent's properties"}
$$K_b = \frac{R\, M_1\, T_b^2}{1000\, \Delta_{vap}H}$$
$$K_f = \frac{R\, M_1\, T_f^2}{1000\, \Delta_{fus}H}$$
$R$ = 8.314 J K⁻¹ mol⁻¹, $M_1$ = molar mass of solvent in g/mol, $T_b$, $T_f$ = boiling and freezing points of the **pure solvent** in K, $\Delta H$ in J/mol.
:::

| Solvent (NCERT Table 1.3) | $K_b$ / K kg mol⁻¹ | $K_f$ / K kg mol⁻¹ |
| --- | --- | --- |
| Water | 0.52 | 1.86 |
| Ethanol | 1.20 | 1.99 |
| Benzene | 2.53 | 5.12 |
| Chloroform | 3.63 | 4.79 |
| Carbon tetrachloride | 5.03 | 31.8 |
| Cyclohexane | 2.79 | 20.00 |
| Acetic acid | 2.93 | 3.90 |

:::formula{title="Osmotic pressure"}
$$\Pi = C R T$$
$$\Pi = \frac{n_2}{V} R T$$
$$M_2 = \frac{w_2 R T}{\Pi V}$$
$C$ = molarity, $V$ = volume of **solution** in litres, $T$ in K. With $R$ = 0.083 L bar mol⁻¹ K⁻¹, $\Pi$ comes in bar (with 0.0821 L atm mol⁻¹ K⁻¹, in atm). Dilute solutions.
:::

## Abnormal molar mass: van't Hoff factor

:::formula{title="van't Hoff factor"}
$$i = \frac{\text{normal molar mass}}{\text{abnormal molar mass}}$$
$$i = \frac{\text{observed property}}{\text{calculated property}}$$
$$i = \frac{\text{particles after}}{\text{particles before}}$$
"Property" = the colligative property; "particles" = moles of particles after and before dissociation or association. The calculated value assumes neither happens.
Dissociation: $i > 1$. Association: $i < 1$. No change: $i = 1$.
:::

:::formula{title="Colligative equations with i"}
$$\frac{p_1^0 - p_1}{p_1^0} = i\,\frac{n_2}{n_1}$$
$$\Delta T_b = i\, K_b\, m$$
$$\Delta T_f = i\, K_f\, m$$
$$\Pi = \frac{i\, n_2 R T}{V}$$
:::

:::formula{title="i from the degree of dissociation or association (exam extra)"}
Dissociation of one unit into $n$ ions, degree $\alpha$:
$$i = 1 + (n - 1)\,\alpha$$
Association of $n$ molecules into one, degree $\alpha$:
$$i = 1 - \alpha\left(1 - \tfrac{1}{n}\right)$$
These are the general forms of NCERT Examples 1.13 (acetic acid in water, $i = 1 + \alpha$) and 1.12 (benzoic acid dimer, $i = 1 - \alpha/2$).
:::
