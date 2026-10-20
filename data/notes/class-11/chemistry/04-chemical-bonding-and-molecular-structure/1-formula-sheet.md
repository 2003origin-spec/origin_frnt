---
title: "Chemical Bonding: Formula Sheet"
type: formula_sheet
chapter: c11.chemistry.chemical-bonding-and-molecular-structure
order: 1
---

## Lewis structures

:::formula{title="Formal charge"}
$$\text{FC} = V - L - \tfrac12 S$$
$V$ = valence electrons of the free atom, $L$ = non-bonding (lone pair) electrons on it, $S$ = bonding (shared) electrons around it.

The best Lewis structure has the **smallest** formal charges.
:::

:::example{title="Formal charges in ozone"}
Central O: $6 - 2 - \tfrac12(6) = +1$. Double-bonded end O: $6 - 4 - \tfrac12(4) = 0$. Single-bonded end O: $6 - 6 - \tfrac12(2) = -1$.
:::

## Dipole moment

:::formula{title="Dipole moment"}
$$\mu = q \times d$$
Unit: debye (the SI unit is C m). $1\ \text{D} = 3.33564 \times 10^{-30}$ C m.

It is a vector. By convention (current NCERT) the dipole-moment vector points from the **negative** centre to the **positive** centre. On structures, chemists draw a crossed arrow instead: the cross at the positive end, the head at the negative end, showing which way the electrons shift. So the crossed arrow points the **opposite** way to the dipole-moment vector.
:::

:::formula{title="Two bond dipoles at an angle"}
$$\mu = \sqrt{\mu_1^2 + \mu_2^2 + 2\mu_1\mu_2\cos\theta}$$
The molecule's dipole moment is the vector sum of its bond dipoles (and lone pairs). $\theta$ = angle between the two bond dipoles (for $\ce{H2O}$, the bond angle 104.5°).
:::

:::formula{title="Percentage ionic character (exam extra)"}
$$\%\ \text{ionic character} = \frac{\mu_{\text{observed}}}{\mu_{\text{ionic}}} \times 100$$
$$\mu_{\text{ionic}} = e \times d$$
$e = 1.602 \times 10^{-19}$ C, $d$ = bond length.
:::

## Hybridisation and shape

:::formula{title="Hybridisation shortcut (not in NCERT)"}
$$H = \tfrac12\,(V + M - C + A)$$
$V$ = valence electrons of the central atom, $M$ = monovalent atoms around it (H, F, Cl, Br, I), $C$ = positive charge, $A$ = negative charge.

$H$ = 2, 3, 4, 5, 6, 7 means sp, sp², sp³, sp³d, sp³d², sp³d³.

Lone pairs on the central atom $= H - $ (number of atoms bonded to it).

It works only for main-group species with an **even** number of electrons. For an odd-electron species such as $\ce{NO2}$ (it gives 2.5), use the Lewis structure instead: $\ce{NO2}$ is bent and sp². It does not apply to complex ions.
:::

:::example{title="Using the shortcut"}
$\ce{NH4+}$: $\tfrac12(5 + 4 - 1) = 4$, so sp³. $\ce{XeF4}$: $\tfrac12(8 + 4) = 6$, so sp³d², with $6 - 4 = 2$ lone pairs. $\ce{CO2}$: O is not monovalent, so $\tfrac12(4) = 2$, sp.
:::

| Electron pairs (a multiple bond counts as one) | Bond pairs | Lone pairs | Shape | Example |
| --- | --- | --- | --- | --- |
| 2 | 2 | 0 | Linear (180°) | $\ce{BeCl2}$, $\ce{CO2}$ |
| 3 | 3 | 0 | Trigonal planar (120°) | $\ce{BF3}$ |
| 3 | 2 | 1 | Bent | $\ce{SO2}$, $\ce{O3}$ |
| 4 | 4 | 0 | Tetrahedral (109.5°) | $\ce{CH4}$, $\ce{NH4+}$ |
| 4 | 3 | 1 | Trigonal pyramidal (107°) | $\ce{NH3}$ |
| 4 | 2 | 2 | Bent (104.5°) | $\ce{H2O}$ |
| 5 | 5 | 0 | Trigonal bipyramidal | $\ce{PCl5}$ |
| 5 | 4 | 1 | See-saw | $\ce{SF4}$ |
| 5 | 3 | 2 | T-shaped | $\ce{ClF3}$ |
| 5 | 2 | 3 | Linear | $\ce{XeF2}$, $\ce{I3-}$ |
| 6 | 6 | 0 | Octahedral | $\ce{SF6}$ |
| 6 | 5 | 1 | Square pyramidal | $\ce{BrF5}$ |
| 6 | 4 | 2 | Square planar | $\ce{XeF4}$ |
| 7 | 7 | 0 | Pentagonal bipyramidal | $\ce{IF7}$ |

## Molecular orbital theory

:::formula{title="Bond order"}
$$\text{Bond order} = \tfrac12\,(N_b - N_a)$$
$N_b$ = electrons in bonding orbitals, $N_a$ = electrons in antibonding orbitals.

Higher bond order: shorter bond, higher bond enthalpy, more stable. Bond order 0: the molecule does not exist.
:::

:::formula{title="Energy order of molecular orbitals"}
Up to $\ce{N2}$ (14 electrons or fewer): $\sigma 1s < \sigma^* 1s < \sigma 2s < \sigma^* 2s < (\pi 2p_x = \pi 2p_y) < \sigma 2p_z < (\pi^* 2p_x = \pi^* 2p_y) < \sigma^* 2p_z$

For $\ce{O2}$ and $\ce{F2}$: $\sigma 2p_z$ comes **below** the $\pi 2p$ pair. The rest stays the same.
:::

:::formula{title="Magnetic behaviour"}
Any unpaired electron: **paramagnetic** (attracted by a magnet). All electrons paired: **diamagnetic** (weakly repelled by a magnet).
:::

| Species | Electrons | Bond order | Magnetic |
| --- | --- | --- | --- |
| $\ce{H2+}$ | 1 | 0.5 | Paramagnetic |
| $\ce{H2}$ | 2 | 1 | Diamagnetic |
| $\ce{He2+}$ | 3 | 0.5 | Paramagnetic |
| $\ce{He2}$ | 4 | 0 | Does not exist |
| $\ce{Li2}$ | 6 | 1 | Diamagnetic |
| $\ce{Be2}$ | 8 | 0 | Does not exist |
| $\ce{B2}$ | 10 | 1 | Paramagnetic |
| $\ce{C2}$ | 12 | 2 | Diamagnetic |
| $\ce{N2}$ | 14 | 3 | Diamagnetic |
| $\ce{O2}$ | 16 | 2 | Paramagnetic |
| $\ce{F2}$ | 18 | 1 | Diamagnetic |
| $\ce{Ne2}$ | 20 | 0 | Does not exist |

:::formula{title="Oxygen and nitrogen ions"}
$\ce{O2+}$ 2.5, $\ce{O2}$ 2, $\ce{O2-}$ (superoxide) 1.5, $\ce{O2^2-}$ (peroxide) 1. Only the peroxide ion is diamagnetic.

$\ce{N2+}$ and $\ce{N2-}$ both have bond order 2.5, and both are paramagnetic.
:::

## Ionic bond

:::formula{title="Born–Haber cycle for NaCl (from NCERT Unit 5, Thermodynamics)"}
$$\begin{aligned} \Delta_f H = {} & \Delta_{sub}H + \Delta_i H \\ & + \tfrac12\Delta_{bond}H + \Delta_{eg}H \\ & - \Delta_{lattice}H \end{aligned}$$
Lattice enthalpy is the energy needed to break one mole of the solid into gaseous ions. For NaCl it is **+788 kJ/mol**.

Watch the signs: $\Delta_{eg}H$ is negative ($-348.6$ kJ/mol for Cl) and $\Delta_{lattice}H$ is positive. With NCERT's values: $\Delta_{lattice}H = 411.2 + 108.4 + 121 + 496 - 348.6 = 788$ kJ/mol.
:::

## Numbers worth knowing

| Quantity | Value |
| --- | --- |
| Bond lengths | C–C ≈ 154 pm, C=C ≈ 133–134 pm, C≡C ≈ 120 pm |
| O–O in ozone | Both 128 pm (O–O single 148 pm, O=O double 121 pm) |
| Bond enthalpies | H–H 435.8, O=O 498, N≡N 946 kJ/mol |
| Bond angles | $\ce{CH4}$ 109.5°, $\ce{NH3}$ 107°, $\ce{H2O}$ 104.5° |
| Dipole moments | $\ce{H2O}$ 1.85 D, $\ce{NH3}$ 1.47 D, $\ce{NF3}$ 0.23 D |
| Zero dipole moment | $\ce{CO2}$, $\ce{BF3}$, $\ce{CH4}$, $\ce{CCl4}$, $\ce{BeF2}$ |
