---
title: "Coordination Compounds: Formula Sheet"
type: formula_sheet
chapter: c12.chemistry.coordination-compounds
order: 1
---

## Counting rules

:::formula{title="Oxidation number of the central atom"}
$$x + \sum q_L = q_{\text{complex}}$$
$x$ = oxidation number of the metal, $q_L$ = charge of each ligand, $q_{\text{complex}}$ = charge of the whole coordination entity. Neutral ligands ($\ce{H2O}$, $\ce{NH3}$, CO, en, py) count 0. $\ce{Cl-}$, $\ce{CN-}$, $\ce{OH-}$, $\ce{NO2-}$, $\ce{SCN-}$ count −1; $\ce{C2O4^2-}$, $\ce{CO3^2-}$, $\ce{SO4^2-}$ count −2; $\ce{edta^4-}$ counts −4.

Find the charge of the complex from the counter ions first.
:::

:::example{title="Oxidation number"}
$\ce{K3[Fe(CN)6]}$: the complex is $-3$, so $x + 6(-1) = -3$ and $x = +3$, Fe(III).

$\ce{[Co(H2O)(CN)(en)2]^2+}$: $x + 0 - 1 + 0 = +2$, so $x = +3$.
:::

:::formula{title="Coordination number (CN)"}
$$\text{CN} = \sum n_i\, d_i$$
$n_i$ = number of ligands of one kind, $d_i$ = their denticity (donor atoms each). CN = number of **donor atoms** (σ bonds) bound to the metal. π bonds are not counted.

$\ce{[Co(en)3]^3+}$ and $\ce{[Fe(C2O4)3]^3-}$: CN = 3 × 2 = 6. One $\ce{edta^4-}$ alone gives CN = 6 (2 N + 4 O).
:::

## Werner's experiments

:::formula{title="Ions outside the bracket"}
Only ions **outside** the square bracket ionise. With excess $\ce{AgNO3}$:
$$n(\ce{AgCl}) = n(\text{complex}) \times k$$
$k$ = number of $\ce{Cl-}$ ions **outside** the bracket. Molar mass of AgCl = 143.5 g/mol (Ag = 108, Cl = 35.5).
:::

| Formula | Ions | Electrolyte | mol AgCl |
| --- | --- | --- | --- |
| $\ce{[Co(NH3)6]Cl3}$ | 4 | 1:3 | 3 |
| $\ce{[CoCl(NH3)5]Cl2}$ | 3 | 1:2 | 2 |
| $\ce{[CoCl2(NH3)4]Cl}$ | 2 | 1:1 | 1 |
| $\ce{[CoCl3(NH3)3]}$ | 0 | non-electrolyte | 0 |

The last row is not in NCERT's Table 5.1; it follows the same rule.

## Magnetic moment

:::formula{title="Spin-only magnetic moment (from NCERT Unit 4)"}
$$\mu = \sqrt{n(n+2)}\ \text{BM}$$
$n$ = number of unpaired electrons, $\mu$ in Bohr magnetons (BM). Use it for complexes of the 3d series.
:::

| $n$ | $\mu$ (BM) | Example |
| --- | --- | --- |
| 0 | 0 | $\ce{[Co(NH3)6]^3+}$, $\ce{[Ni(CN)4]^2-}$ |
| 1 | 1.73 | $\ce{[Fe(CN)6]^3-}$ |
| 2 | 2.83 | $\ce{[NiCl4]^2-}$, $\ce{[Mn(CN)6]^3-}$ |
| 3 | 3.87 | $\ce{[Cr(NH3)6]^3+}$ |
| 4 | 4.90 | $\ce{[CoF6]^3-}$, $\ce{[MnCl6]^3-}$ |
| 5 | 5.92 | $\ce{[FeF6]^3-}$, $\ce{[MnBr4]^2-}$ |

## Valence bond theory

| CN | Hybridisation | Shape | Example |
| --- | --- | --- | --- |
| 4 | sp³ | Tetrahedral | $\ce{[NiCl4]^2-}$, $\ce{[Ni(CO)4]}$ |
| 4 | dsp² | Square planar | $\ce{[Ni(CN)4]^2-}$ |
| 5 | sp³d | Trigonal bipyramidal | (none in NCERT) |
| 6 | d²sp³ (inner) | Octahedral | $\ce{[Co(NH3)6]^3+}$ |
| 6 | sp³d² (outer) | Octahedral | $\ce{[CoF6]^3-}$ |

d²sp³ uses inner (n−1)d orbitals: **inner orbital**. sp³d² uses outer nd orbitals: **outer orbital**. For d⁴ to d⁶ ions, inner orbital means **low spin** and outer orbital **high spin**; for d¹–d³ and d⁸ the number of unpaired electrons is the same either way.

Table 5.2 lists sp³d for CN 5 but gives no example. $\ce{[Fe(CO)5]}$ is trigonal bipyramidal; since Fe(0) pairs its electrons and uses an inner 3d orbital, exam keys write it as **dsp³** (exam extra, not in NCERT).

## Crystal field theory

:::formula{title="Octahedral splitting"}
$$E(e_g) = +\tfrac35\,\Delta_o$$
$$E(t_{2g}) = -\tfrac25\,\Delta_o$$
Energies relative to the average (spherical field). $e_g$ = $d_{x^2-y^2}$, $d_{z^2}$ (point at the ligands, raised). $t_{2g}$ = $d_{xy}$, $d_{yz}$, $d_{xz}$ (between the axes, lowered).
:::

:::formula{title="Tetrahedral splitting"}
$$\Delta_t = \tfrac49\,\Delta_o$$
Holds for the same metal, the same ligands and the same metal–ligand distance. The order is **inverted**: $e$ below, $t_2$ above (no "g", since a tetrahedron has no centre of symmetry). $\Delta_t$ is small, so tetrahedral complexes are almost always **high spin**.
:::

:::formula{title="High spin or low spin (octahedral d⁴ to d⁷)"}
$\Delta_o < P$: weak field ligand, electrons go to $e_g$ before pairing: **high spin**.

$\Delta_o > P$: strong field ligand, electrons pair in $t_{2g}$ first: **low spin**.

$P$ = pairing energy (energy needed to pair two electrons in one orbital).
:::

| d electrons | High spin | Low spin |
| --- | --- | --- |
| d⁴ | $t_{2g}^3 e_g^1$ (4 unpaired) | $t_{2g}^4 e_g^0$ (2) |
| d⁵ | $t_{2g}^3 e_g^2$ (5) | $t_{2g}^5 e_g^0$ (1) |
| d⁶ | $t_{2g}^4 e_g^2$ (4) | $t_{2g}^6 e_g^0$ (0) |
| d⁷ | $t_{2g}^5 e_g^2$ (3) | $t_{2g}^6 e_g^1$ (1) |

d¹, d², d³, d⁸, d⁹, d¹⁰ have only one possible arrangement in an octahedral field.

:::formula{title="Crystal field stabilisation energy (exam extra)"}
$$\text{CFSE} = (-0.4\,x + 0.6\,y)\,\Delta_o$$
$x$ = electrons in $t_{2g}$, $y$ = electrons in $e_g$ (octahedral). NCERT gives the 2/5 and 3/5 values but not the name CFSE; JEE Main and NEET ask it under "basic ideas of crystal field theory". Some books also add $P$ for each extra pair; leave it out unless the question asks.

Low spin d⁶: $6(-0.4) = -2.4\,\Delta_o$. High spin d⁵: $3(-0.4) + 2(0.6) = 0$.
:::

:::formula{title="Splitting energy from the colour"}
$$\Delta_o = \frac{N_A\,h\,c}{\lambda}$$
$\lambda$ = wavelength absorbed (m), $h = 6.626 \times 10^{-34}$ J s, $c = 3.0 \times 10^{8}$ m/s, $N_A = 6.022 \times 10^{23}$ mol⁻¹. Gives J/mol. Uses $E = hc/\lambda$ from Class 11. Valid for a single d–d band, as in d¹ $\ce{[Ti(H2O)6]^3+}$.

Larger $\Delta_o$ means a **shorter** wavelength absorbed.
:::

## Spectrochemical series (NCERT)

Increasing field strength (increasing $\Delta_o$):

$$\begin{aligned} & \ce{I- < Br- < SCN- < Cl- < S^2-} \\ & \ce{< F- < OH- < C2O4^2- < H2O} \\ & \ce{< NCS- < edta^4- < NH3 < en} \\ & \ce{< CN- < CO} \end{aligned}$$

Weak end: halides, $\ce{OH-}$. Strong end: en, $\ce{CN-}$, CO. $\ce{SCN-}$ binds through S, $\ce{NCS-}$ through N.

## Counting stereoisomers

| Type | Geometrical | Optical | Total |
| --- | --- | --- | --- |
| Square planar $\ce{[MA2B2]}$ | 2 | 0 | 2 |
| Square planar $\ce{[MABCD]}$ | 3 | 0 | 3 |
| $\ce{[MA4B2]}$ | 2 (cis, trans) | 0 | 2 |
| $\ce{[MA3B3]}$ | 2 (fac, mer) | 0 | 2 |
| $\ce{[M(AA)3]}$ | 1 | 1 pair | 2 |
| $\ce{[M(AA)2B2]}$ | 2 | cis only | 3 |
| $\ce{[MA2B2(AA)]}$ | 3 | 1 pair | 4 |
| $\ce{[MA2B2C2]}$ (exam extra) | 5 | 1 pair | 6 |

A, B, C, D = unidentate ligands; AA = symmetric didentate (en, ox). "Total" = all stereoisomers, counting d and l separately. Tetrahedral complexes show **no** geometrical isomerism: all four positions are adjacent to each other.
