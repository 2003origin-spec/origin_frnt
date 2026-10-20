---
title: "Electrochemistry: Important Points and Traps"
type: key_points
chapter: c12.chemistry.electrochemistry
order: 3
---

## Signs and conventions

:::trap
**The anode's sign depends on the cell.** In a galvanic cell the anode is **negative**; in an electrolytic cell it is **positive**. What never changes: oxidation at the anode, reduction at the cathode.
:::

:::trap
$E^\circ_{cell} = E^\circ_{cathode} - E^\circ_{anode}$, using **reduction** potentials for both. Don't flip the anode's sign **and** subtract: that counts the change twice. Zn–Cu: $0.34 - (-0.76) = 1.10$ V, not $0.34 - 0.76$.
:::

- Electrons flow anode → cathode in the outer wire. Current flows cathode → anode. Inside the cell, ions carry the charge.
- The cell is written with the anode on the **left**. Then $E_{cell} = E_{right} - E_{left}$ is positive for a working cell.

:::tip
**"An Ox, Red Cat":** **An**ode = **Ox**idation, **Red**uction = **Cat**hode. True for every cell.
:::

## Electrode potentials

- **Higher $E^\circ$, stronger oxidising agent** (left side of the table). **Lower $E^\circ$, stronger reducing agent** (right side). $\ce{F2}$ is the strongest oxidant; Li the strongest reductant in water.
- Increasing reducing power: Ag < Cu < $\ce{H2}$ < Fe < Zn < Al < Mg.
- Copper can't displace $\ce{H2}$ from HCl ($E^\circ$ = +0.34 V). It dissolves in $\ce{HNO3}$ because **nitrate** oxidises it.
- A $\ce{CuSO4}$ solution can't be kept in a zinc pot: Zn (−0.76 V) displaces Cu. It can be kept in a silver or copper vessel.

:::trap
**$E^\circ$ is intensive.** Multiplying a half-reaction by 2 does **not** double $E^\circ$. $\ce{Ag+ + e- -> Ag}$ and $\ce{2Ag+ + 2e- -> 2Ag}$ both have $E^\circ$ = 0.80 V. $\Delta_r G$ is extensive: it doubles.
:::

:::trap
(Exam extra, not in NCERT; it follows from $\Delta G^\circ = -nFE^\circ$.) When two half-reactions combine into a **new half-reaction**, electrons don't cancel, so $E^\circ$ values can't simply be added or subtracted. Add $nE^\circ$ (that is, $\Delta G^\circ$) and divide by the new $n$. For a full cell reaction, the plain $E^\circ_{cathode} - E^\circ_{anode}$ is correct.
:::

- SHE: $E^\circ = 0$ at **all temperatures** (a convention). Class 12 NCERT takes $\ce{H2}$ at **1 bar**; the Class 11 Redox Reactions unit uses the older 1 atm. The difference is tiny; use 1 bar here.

## Nernst equation

:::trap
In $Q$, **products go on top**, each raised to its coefficient. Pure solids and liquids (Zn, Cu, Ag, $\ce{H2O}$) count as 1, and gases enter as partial pressure in bar. Use the **same $n$** for the whole cell.
:::

- 0.059 V = $2.303RT/F$ at **298 K only**.
- Zn–Cu cell: more $\ce{Cu^2+}$ (reactant) raises $E_{cell}$; more $\ce{Zn^2+}$ (product) lowers it.
- At equilibrium the cell is "dead": $E_{cell} = 0$, $Q = K$. But $E^\circ_{cell}$ is **not** zero; it fixes $K$.

:::remember
Hydrogen electrode at 1 bar: $E = -0.059\,\text{pH}$. More acidic (lower pH) gives a less negative potential.
:::

## Conductance

:::trap
On dilution **$\kappa$ falls** but **$\Lambda_m$ rises**, for strong and weak electrolytes alike. Mixing these two up is the commonest mistake in this chapter.
:::

:::trap
**Units.** $\Lambda_m = 1000\kappa/M$ needs $\kappa$ in S cm⁻¹ and $M$ in mol L⁻¹, giving S cm² mol⁻¹. In SI, $\kappa$ (S m⁻¹) ÷ $c$ (mol **m⁻³**) gives S m² mol⁻¹. $1\ \text{S m}^2\text{mol}^{-1} = 10^4\ \text{S cm}^2\text{mol}^{-1}$, and 1 mol L⁻¹ = 1000 mol m⁻³.
:::

- Cell constant $G^* = l/A$ is a property of the **cell**, not the solution. Its unit is m⁻¹ (or cm⁻¹).
- Measure with **AC**, never DC (DC electrolyses the solution). The electrodes are **platinised** Pt.
- Metallic conductance falls with temperature; electrolytic conductivity rises with it.
- $\ce{H+}$ (349.6) and $\ce{OH-}$ (199.1 S cm² mol⁻¹) have far higher $\lambda^\circ$ than other ions, so **strong** acids and bases conduct best at equal concentration. (Weak acids such as acetic acid still conduct poorly: they are barely ionised.)

:::trap
$\Lambda_m^\circ$ of a **weak** electrolyte (acetic acid) can't be found by extrapolating the $\Lambda_m$ vs $\sqrt c$ graph: the curve shoots up near $c = 0$. Use Kohlrausch's law.
:::

- $\Lambda_m = \Lambda_m^\circ - A\sqrt c$ is for **strong** electrolytes only. All electrolytes of one type (1-1, 2-1, 2-2) have the same $A$ in a given solvent at a given temperature.
- Kohlrausch counts ions per formula unit: $\Lambda_m^\circ(\ce{CaCl2}) = \lambda^\circ_{\ce{Ca^2+}} + 2\lambda^\circ_{\ce{Cl-}}$.

:::tip
To get $\Lambda_m^\circ$ of a weak electrolyte AB: pick three strong electrolytes so that the unwanted ions cancel. **AX + YB − YX = AB.** Water: $\Lambda^\circ(\ce{HCl}) + \Lambda^\circ(\ce{NaOH}) - \Lambda^\circ(\ce{NaCl})$.
:::

## Electrolysis

:::trap
Aqueous NaCl gives $\ce{Cl2}$ at the anode, **not** $\ce{O2}$, even though water's $E^\circ$ (1.23 V) is lower than chlorine's (1.36 V). The reason is the **overpotential** of oxygen. At an inert cathode you get $\ce{H2}$, not Na (Na forms only from molten NaCl).
:::

- Molten NaCl: Na and $\ce{Cl2}$. Aqueous NaCl: $\ce{H2}$, $\ce{Cl2}$ and NaOH.
- Dilute $\ce{H2SO4}$: $\ce{O2}$ at the anode. Concentrated: $\ce{S2O8^2-}$.
- $\ce{AgNO3}$ with **Ag** electrodes: Ag dissolves at the anode, deposits at the cathode. With **Pt** electrodes: Ag at the cathode, $\ce{O2}$ at the anode.
- $\ce{CuCl2}$ with Pt electrodes: Cu at the cathode, $\ce{Cl2}$ at the anode.

:::trap
Time must be in **seconds** in $Q = It$. Charge needed depends on electrons per ion: 1 mol $\ce{Al^3+}$ → Al needs 3F; 1 mol $\ce{MnO4-}$ → $\ce{Mn^2+}$ needs 5F; 1 mol $\ce{Cr2O7^2-}$ → $\ce{Cr^3+}$ needs 6F.
:::

- Cells in series pass the **same charge**. 1 mol e⁻ gives 108 g Ag, 31.75 g Cu, 9 g Al.

## Batteries, fuel cells, corrosion

:::remember
- Dry cell: about 1.5 V; Mn goes from +4 to +3.
- Mercury cell: about 1.35 V and **constant**, because no ion's concentration changes in the overall reaction.
- Lead storage battery: **38% $\ce{H2SO4}$**; $\ce{PbSO4}$ forms on **both** electrodes during discharge, and the acid is used up.
- Ni–Cd: longer life than lead storage, more expensive.
- $\ce{H2}$–$\ce{O2}$ fuel cell: concentrated NaOH, porous carbon electrodes, Pt/Pd catalyst, about 70% efficient (thermal plant about 40%). Used in Apollo.
:::

- Rusting needs both **water and oxygen**. Rust is **$\ce{Fe2O3 . xH2O}$** (hydrated ferric oxide). $E^\circ_{cell}$ for the rusting cell = 1.67 V.
- Sacrificial protection uses a **more reactive** metal (Mg, Zn): it corrodes, the iron is saved.

## NCERT values to know

:::remember
$F$ = 96487 C mol⁻¹ (≈ 96500). Daniell cell: $E^\circ$ = 1.1 V, $\Delta_r G^\circ = -212.27$ kJ mol⁻¹. $\Lambda_m^\circ$(acetic acid) = 390.5 S cm² mol⁻¹. KCl solutions are the standard for cell constants.
:::
