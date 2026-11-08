---
title: "Some Basic Concepts of Chemistry: Formula Sheet"
type: formula_sheet
chapter: c11.chemistry.some-basic-concepts-of-chemistry
order: 1
---

## Measurement

:::formula{title="Temperature scales"}
$$t_F = \tfrac95\, t_C + 32$$
$$T = t_C + 273.15$$
$t_F$ = reading in °F, $t_C$ = reading in °C, $T$ = temperature in kelvin (K, the SI unit).

Water freezes at 0 °C = 32 °F and boils at 100 °C = 212 °F. Negative values are possible in °C, but never in kelvin.
:::

:::formula{title="Density"}
$$d = \frac{m}{V}$$
SI unit kg m⁻³. Chemists usually use g cm⁻³ (the same as g mL⁻¹). $1$ g cm⁻³ $= 1000$ kg m⁻³.
:::

:::formula{title="Volume units"}
$$1\ \text{L} = 1000\ \text{mL} = 1\ \text{dm}^3$$
$$1\ \text{mL} = 1\ \text{cm}^3$$
$$1\ \text{m}^3 = 1000\ \text{L} = 10^6\ \text{cm}^3$$
The litre is **not** an SI unit. The SI unit of volume is m³.
:::

| Prefix | Symbol | Multiple |
| --- | --- | --- |
| femto | f | $10^{-15}$ |
| pico | p | $10^{-12}$ |
| nano | n | $10^{-9}$ |
| micro | µ | $10^{-6}$ |
| milli | m | $10^{-3}$ |
| centi | c | $10^{-2}$ |
| deci | d | $10^{-1}$ |
| deca | da | $10^{1}$ |
| kilo | k | $10^{3}$ |
| mega | M | $10^{6}$ |
| giga | G | $10^{9}$ |
| tera | T | $10^{12}$ |

:::formula{title="Significant figures in calculations"}
**Adding or subtracting:** keep as many digits **after the decimal point** as the number with the fewest such digits. $12.11 + 18.0 + 1.012 = 31.122$, reported as **31.1**.

**Multiplying or dividing:** keep as many **significant figures** as the number with the fewest. $2.5 \times 1.25 = 3.125$, reported as **3.1**.
:::

## Atomic and molecular mass

:::formula{title="Atomic mass unit"}
$$1\ \text{u} = \tfrac{1}{12}\, m(^{12}\text{C})$$
$$1\ \text{u} = 1.66056 \times 10^{-24}\ \text{g}$$
$m(^{12}\text{C})$ = mass of one carbon-12 atom, which is given exactly 12 u (the standard since 1961). The old symbol "amu" is now written "u" (unified mass).
:::

:::formula{title="Average atomic mass"}
$$\bar{A} = \sum x_i A_i$$
$x_i$ = fractional abundance of isotope $i$ (per cent ÷ 100), $A_i$ = its atomic mass in u. The fractions add up to 1.

The atomic masses in the periodic table are these averages.
:::

:::example{title="Chlorine (NCERT data)"}
$^{35}$Cl 75.77%, 34.9689 u; $^{37}$Cl 24.23%, 36.9659 u.

$(0.7577)(34.9689) + (0.2423)(36.9659) = 26.496 + 8.957 \approx$ **35.45 u**.
:::

:::formula{title="Molecular mass and formula mass"}
Molecular mass = sum of the atomic masses of all atoms in the molecule. $\ce{CH4}$: $12.011 + 4(1.008) = 16.043$ u.

For ionic solids such as NaCl, which have no separate molecules, the same sum is called the **formula mass**: $23.0 + 35.5 = 58.5$ u.
:::

## Mole concept

:::formula{title="Moles from mass"}
$$n = \frac{m}{M}$$
$n$ = amount in mol, $m$ = mass in g, $M$ = molar mass in g mol⁻¹.

The molar mass in g mol⁻¹ has the same number as the atomic, molecular or formula mass in u ($\ce{H2O}$: 18.02 u, so 18.02 g mol⁻¹).
:::

:::formula{title="Moles from number of particles"}
$$n = \frac{N}{N_A}$$
$N$ = number of particles, $N_A$ = Avogadro constant $= 6.02214076 \times 10^{23}$ mol⁻¹ (exact). Use $6.022 \times 10^{23}$ in sums.

Always say **which** particle: 1 mol of $\ce{O2}$ has $N_A$ molecules but $2N_A$ atoms.
:::

:::formula{title="Moles of a gas from volume"}
$$n = \frac{V}{22.7\ \text{L mol}^{-1}}$$
Only for a gas (treated as ideal) at **STP: 273.15 K and 1 bar**. 22.7 L is the value NCERT uses (its methane example: 22.7 L of $\ce{CH4}$ needs 45.4 L of $\ce{O2}$).

Many older books and some exam questions use **22.4 L** (273.15 K and **1 atm**). Use the value the question gives.
:::

:::formula{title="Mass of one particle"}
$$m_{\text{one}} = \frac{M}{N_A}$$
One $^{12}$C atom: $\dfrac{12}{6.022 \times 10^{23}} = 1.99 \times 10^{-23}$ g.
:::

## Composition and formulas

:::formula{title="Mass per cent of an element"}
$$\%\,X = \frac{\text{mass of X in 1 mol}}{M} \times 100$$
Water: $\%\,\text{H} = \dfrac{2.016}{18.02} \times 100 \approx 11.19\%$ (NCERT prints 11.18%), and O is $\dfrac{16.00}{18.02} \times 100 = 88.79\%$.
:::

:::formula{title="Empirical to molecular formula"}
$$n = \frac{\text{molar mass}}{\text{empirical formula mass}}$$
Molecular formula $= (\text{empirical formula})_n$, where $n$ is a whole number.

NCERT example: empirical formula $\ce{CH2Cl}$ (49.48 g), molar mass 98.96 g, so $n = 2$ and the molecular formula is $\ce{C2H4Cl2}$.
:::

## Stoichiometry

:::formula{title="Mole ratio from the balanced equation"}
For $a\,\text{A} + b\,\text{B} \to c\,\text{C}$, the moles that react and form are in the ratio of the coefficients:
$$\frac{n_A}{a} = \frac{n_B}{b} = \frac{n_C}{c}$$
The equation must be **balanced** first. The coefficients give ratios of molecules and moles, and of gas volumes at the same $T$ and $P$. They do **not** give ratios of masses.
:::

:::formula{title="Limiting reagent"}
Work out $\dfrac{\text{moles available}}{\text{coefficient}}$ for each reactant. The **smallest** value is the limiting reagent. It is used up first and fixes how much product forms.
:::

:::formula{title="Percentage yield (exam extra, not in NCERT)"}
$$\%\ \text{yield} = \frac{\text{actual}}{\text{theoretical}} \times 100$$
Actual and theoretical yield in the same unit (g or mol). The theoretical yield comes from the limiting reagent.
:::

## Concentration of solutions

:::formula{title="Mass per cent (w/w)"}
$$w\% = \frac{m_{\text{solute}}}{m_{\text{solution}}} \times 100$$
$m_{\text{solution}} = m_{\text{solute}} + m_{\text{solvent}}$. NCERT: 2 g of A in 18 g of water is $\tfrac{2}{20} \times 100 = 10\%$.
:::

:::formula{title="Parts per million (by mass)"}
$$\text{ppm} = \frac{m_{\text{solute}}}{m_{\text{solution}}} \times 10^6$$
Used for very small amounts. 15 ppm $= 15 \times 10^{-4}$ per cent.
:::

:::formula{title="Mole fraction"}
$$x_A = \frac{n_A}{n_A + n_B}$$
$$x_A + x_B = 1$$
No unit. For more components, divide by the total moles; all the mole fractions add up to 1.
:::

:::formula{title="Molarity"}
$$M = \frac{n_{\text{solute}}}{V_{\text{solution}}\ (\text{L})}$$
Unit mol L⁻¹ (written M). Volume of the **solution**, not of the solvent. Molarity **changes with temperature**, because volume does.
:::

:::formula{title="Molality"}
$$m = \frac{n_{\text{solute}}}{\text{mass of solvent (kg)}}$$
Unit mol kg⁻¹ (written m). Mass of the **solvent**, not of the solution. Molality does **not** change with temperature.
:::

:::formula{title="Dilution"}
$$M_1 V_1 = M_2 V_2$$
Adding solvent does not change the moles of solute. $V_1$ and $V_2$ can be in any unit, as long as both use the same one.
:::

:::formula{title="Mixing two solutions of the same solute (exam extra)"}
$$M_{\text{mix}} = \frac{M_1 V_1 + M_2 V_2}{V_1 + V_2}$$
Only if the solute is the same, nothing reacts, and the volumes simply add.
:::

:::formula{title="Molarity from mass per cent and density (shortcut)"}
$$M = \frac{10 \times w\% \times d}{M_s}$$
$M$ = molarity, $d$ = density of the solution in g mL⁻¹, $M_s$ = molar mass of the solute in g mol⁻¹.

NCERT does this step by step (take 1 L of solution); the one-line formula is an exam extra. NCERT Exercise 1.6: 69% $\ce{HNO3}$, $d = 1.41$: $M = \dfrac{10 \times 69 \times 1.41}{63} \approx 15.4$ M.
:::

:::formula{title="Molality from molarity and density (shortcut)"}
$$m = \frac{1000\, M}{1000\, d - M \cdot M_s}$$
Same symbols as above; $m$ = molality. NCERT works this step by step; the formula is an exam extra. NCERT Problem 1.8 (3 M NaCl, $d = 1.25$): $\dfrac{3000}{1250 - 175.5} = 2.79$ m.
:::

:::formula{title="Molality from mole fraction (exam extra)"}
$$m = \frac{1000\, x_B}{x_A\, M_A}$$
$x_B$ = mole fraction of the solute, $x_A$ = mole fraction of the solvent, $M_A$ = molar mass of the solvent in g mol⁻¹.
:::
