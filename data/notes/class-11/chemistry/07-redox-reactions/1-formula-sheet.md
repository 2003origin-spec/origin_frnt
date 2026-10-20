---
title: "Redox Reactions: Formula Sheet"
type: formula_sheet
chapter: c11.chemistry.redox-reactions
order: 1
---

## Oxidation number

:::formula{title="Sum rule"}
$$\sum \text{ON} = \text{charge on the species}$$
Add the oxidation numbers of **all** the atoms. The sum is 0 for a neutral compound and equals the ion's charge for an ion. Oxidation numbers have no unit.
:::

:::example{title="Chromium in dichromate"}
$\ce{Cr2O7^2-}$: $2x + 7(-2) = -2$, so $x = +6$.
:::

| Atom | Usual ON | Exceptions (NCERT) |
| --- | --- | --- |
| Free element ($\ce{O3}$, $\ce{P4}$, $\ce{S8}$, Na) | 0 | none |
| H | +1 | −1 in metal hydrides ($\ce{LiH}$, $\ce{NaH}$, $\ce{CaH2}$) |
| O | −2 | −1 peroxide, −½ superoxide, +2 in $\ce{OF2}$, +1 in $\ce{O2F2}$ |
| F | −1 | none, ever |
| Cl, Br, I | −1 as halide | positive with O (oxoacids, oxoanions) |
| Alkali / alkaline earth metal / Al | +1 / +2 / +3 | none |

:::formula{title="Average (fractional) oxidation number"}
$$\text{average ON} = \frac{\text{sum of ONs}}{\text{no. of atoms}}$$
Count only the atoms of that one element.

A fraction means the atoms are in **different** whole-number states. NCERT examples: $\ce{C3O2}$ $\tfrac43$ (real: +2, 0, +2), $\ce{Br3O8}$ $\tfrac{16}{3}$ (real: +6, +4, +6), $\ce{S4O6^2-}$ 2.5 (real: +5, 0, 0, +5).
:::

:::formula{title="ON from the structure (exam extra)"}
For one atom, add (a double bond counts as two bonds, a triple bond as three):
- +1 for each bond to a **more** electronegative atom;
- −1 for each bond to a **less** electronegative atom;
- 0 for each bond to an atom of the same element;
- its formal charge, if it has one.

This follows NCERT's rule that a shared pair belongs fully to the more electronegative atom. Use it for peroxides, organic compounds and other species with two kinds of the same atom.
:::

:::formula{title="Highest ON of a representative element"}
$$\text{highest ON} = \text{group number}$$
for groups 1 and 2, and
$$\text{highest ON} = \text{group number} - 10$$
for groups 13 to 17 (long form of the periodic table).

Period 3: Na +1, Mg +2, Al +3, Si +4, P +5, S +6, Cl +7. Exceptions: fluorine never shows a positive ON, and oxygen goes no higher than +2 (in $\ce{OF2}$).
:::

## Electron bookkeeping

:::formula{title="Electrons per formula unit"}
$$n = |\Delta \text{ON}| \times \text{atoms that change}$$
$n$ = electrons lost (oxidation) or gained (reduction) by one formula unit. $\ce{Cr2O7^2-}$ to $\ce{Cr^3+}$: $3 \times 2 = 6$. If more than one element in the formula unit changes ON, add up the electrons for each.
:::

:::formula{title="Balancing condition"}
$$\text{total rise in ON} = \text{total fall in ON}$$
That is, electrons lost by the reductant = electrons gained by the oxidant. Both the oxidation number method and the half-reaction method rest on this.
:::

:::formula{title="End point of a redox titration (exam extra)"}
$$M_1 V_1 n_1 = M_2 V_2 n_2$$
$M$ = molarity (mol/L), $V$ = volume (any unit, same on both sides), $n$ = electrons per formula unit (the "n-factor"). Use it only when you know the product each reagent forms. It is a short form of the mole ratio in the balanced equation.
:::

## Half-reactions to know

:::formula{title="Common oxidants"}
$$\begin{aligned} & \ce{MnO4- + 8H+ + 5e-} \\ & \ce{-> Mn^2+ + 4H2O} \end{aligned}$$
$$\begin{aligned} & \ce{Cr2O7^2- + 14H+ + 6e-} \\ & \ce{-> 2Cr^3+ + 7H2O} \end{aligned}$$
$$\begin{aligned} & \ce{MnO4- + 2H2O + 3e-} \\ & \ce{-> MnO2 + 4OH-} \end{aligned}$$
$$\ce{H2O2 + 2H+ + 2e- -> 2H2O}$$
The first, second and fourth are in acid (all three are in NCERT Table 7.1). The third is in basic solution, as in NCERT Problems 7.9 and 7.10; it also holds in neutral solution.
:::

:::formula{title="Common reductants"}
$$\ce{Fe^2+ -> Fe^3+ + e-}$$
$$\ce{C2O4^2- -> 2CO2 + 2e-}$$
$$\ce{2I- -> I2 + 2e-}$$
$$\begin{aligned} & \ce{2S2O3^2-} \\ & \ce{-> S4O6^2- + 2e-} \end{aligned}$$
$$\ce{H2O2 -> O2 + 2H+ + 2e-}$$
:::

| Reagent (product) | Electrons per formula unit |
| --- | --- |
| $\ce{MnO4-}$, acid ($\ce{Mn^2+}$) | 5 |
| $\ce{MnO4-}$, neutral or basic ($\ce{MnO2}$) | 3 |
| $\ce{MnO4-}$, very strongly basic ($\ce{MnO4^2-}$), exam extra | 1 |
| $\ce{Cr2O7^2-}$, acid ($\ce{Cr^3+}$) | 6 |
| $\ce{Fe^2+}$ ($\ce{Fe^3+}$) | 1 |
| $\ce{C2O4^2-}$ ($\ce{CO2}$) | 2 |
| $\ce{S2O3^2-}$ ($\ce{S4O6^2-}$) | 1 |

## Electrode potential

:::formula{title="Standard electrode potential"}
$$\text{Oxidised form} + n e^- \rightarrow \text{Reduced form}$$
Unit: volt (V). Standard means unit concentration of each species, any gas at 1 atm (as NCERT Unit 7 states), and 298 K. By convention $E^\ominus$ of the hydrogen electrode is 0.00 V.

Negative $E^\ominus$: the couple is a **stronger** reducing agent than $\ce{H+}$/$\ce{H2}$. Positive $E^\ominus$: a **weaker** one.
:::

:::formula{title="Will the reaction go? (Class 12 formula, useful here)"}
$$E^\ominus_{cell} = E^\ominus_{cathode} - E^\ominus_{anode}$$
Cathode = the couple that is reduced, anode = the couple that is oxidised, both taken as reduction potentials from the table. $E^\ominus_{cell} > 0$: the reaction is feasible under standard conditions.
:::

| Couple (NCERT Table 7.1) | $E^\ominus$ / V |
| --- | --- |
| $\ce{F2}$/$\ce{F-}$ | +2.87 |
| $\ce{MnO4-}$/$\ce{Mn^2+}$ (acid) | +1.51 |
| $\ce{Cl2}$/$\ce{Cl-}$ | +1.36 |
| $\ce{Cr2O7^2-}$/$\ce{Cr^3+}$ | +1.33 |
| $\ce{Br2}$/$\ce{Br-}$ | +1.09 |
| $\ce{Ag+}$/Ag | +0.80 |
| $\ce{Fe^3+}$/$\ce{Fe^2+}$ | +0.77 |
| $\ce{I2}$/$\ce{I-}$ | +0.54 |
| $\ce{Cu^2+}$/Cu | +0.34 |
| $\ce{H+}$/$\ce{H2}$ | 0.00 |
| $\ce{Ni^2+}$/Ni | −0.25 |
| $\ce{Fe^2+}$/Fe | −0.44 |
| $\ce{Zn^2+}$/Zn | −0.76 |
| $\ce{Mg^2+}$/Mg | −2.36 |
| $\ce{Li+}$/Li | −3.05 |
