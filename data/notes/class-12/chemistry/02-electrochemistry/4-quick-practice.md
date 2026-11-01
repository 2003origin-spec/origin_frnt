---
title: "Electrochemistry: Quick Practice"
type: practice
chapter: c12.chemistry.electrochemistry
order: 4
---

Try each question first, then tap **Show answer**. $E^\circ$ values are from NCERT Table 2.1. Take $2.303RT/F = 0.059$ V at 298 K.

## Galvanic cells and electrode potentials

:::question{title="1. Reducing power" exam="NEET level"}
$E^\circ$ values: $\ce{Ag+/Ag}$ 0.80 V, $\ce{Ni^2+/Ni}$ −0.25 V, $\ce{Zn^2+/Zn}$ −0.76 V, $\ce{Al^3+/Al}$ −1.66 V. Arrange Ag, Ni, Zn and Al in increasing order of reducing power.

---

The more negative $E^\circ$, the stronger the reducing agent:

**Ag < Ni < Zn < Al**
:::

:::question{title="2. Nickel–copper cell" exam="NEET level"}
For $\ce{Ni | Ni^2+ (1 M) || Cu^2+ (1 M) | Cu}$, find $E^\circ_{cell}$ and $\Delta_r G^\circ$. ($E^\circ$: $\ce{Cu^2+/Cu}$ 0.34 V, $\ce{Ni^2+/Ni}$ −0.25 V; $F$ = 96500 C mol⁻¹)

---

$E^\circ_{cell} = 0.34 - (-0.25) = 0.59$ V. The reaction $\ce{Ni + Cu^2+ -> Ni^2+ + Cu}$ has $n = 2$.

$\Delta_r G^\circ = -2 \times 96500 \times 0.59 = -113870$ J mol⁻¹, so **$E^\circ_{cell}$ = 0.59 V and $\Delta_r G^\circ \approx -113.9$ kJ mol⁻¹**.
:::

## Nernst equation

:::question{title="3. Daniell cell off standard" exam="NEET level"}
Find the emf at 298 K of $\ce{Zn | Zn^2+ (0.01 M) || Cu^2+ (1.0 M) | Cu}$, given $E^\circ_{cell}$ = 1.10 V.

---

$E = 1.10 - \dfrac{0.059}{2}\log\dfrac{0.01}{1.0} = 1.10 - 0.0295 \times (-2)$

$E = 1.10 + 0.059 =$ **1.159 V** (about 1.16 V). Less $\ce{Zn^2+}$ (product) raises the emf.
:::

:::question{title="4. pH from a hydrogen cell" exam="JEE Main level"}
At 298 K the cell $\ce{Pt | H2 (1 bar) | H+ (pH = x) || H+ (1 M) | H2 (1 bar) | Pt}$ has emf 0.295 V. Find $x$.

---

The right electrode is standard: $E_{right} = 0$. The left hydrogen electrode: $E_{left} = -0.059x$.

$E_{cell} = E_{right} - E_{left} = 0.059x = 0.295$, so **$x$ = 5**.
:::

:::question{title="5. Equilibrium constant from E°" exam="JEE Main level"}
Find $K_c$ at 298 K for:
$$\begin{aligned} & \ce{Cu(s) + 2Fe^3+(aq)} \\ & \ce{<=> Cu^2+(aq) + 2Fe^2+(aq)} \end{aligned}$$
($E^\circ$: $\ce{Fe^3+/Fe^2+}$ 0.77 V, $\ce{Cu^2+/Cu}$ 0.34 V)

---

Cu is oxidised (anode): $E^\circ_{cell} = 0.77 - 0.34 = 0.43$ V, $n = 2$.

$\log K_c = \dfrac{2 \times 0.43}{0.059} = 14.58$, so **$K_c \approx 3.8 \times 10^{14}$**.
:::

## Conductance

:::question{title="6. Cell constant and Λm" exam="NEET level"}
A conductivity cell has a cell constant of 1.5 cm⁻¹. Filled with a 0.05 M solution of an electrolyte, its resistance is 250 Ω. Find the conductivity and the molar conductivity.

---

$\kappa = G^*/R = 1.5/250 = 6.0 \times 10^{-3}$ S cm⁻¹.

$\Lambda_m = \dfrac{1000 \times 6.0 \times 10^{-3}}{0.05} =$ **120 S cm² mol⁻¹** (and $\kappa$ = **0.006 S cm⁻¹**).
:::

:::question{title="7. Kohlrausch for a weak base" exam="NEET level"}
$\Lambda_m^\circ$ values (S cm² mol⁻¹): $\ce{NH4Cl}$ 149.8, NaOH 249.2, NaCl 126.4. Find $\Lambda_m^\circ$ of $\ce{NH4OH}$.

---

$\Lambda^\circ(\ce{NH4OH}) = \Lambda^\circ(\ce{NH4Cl}) + \Lambda^\circ(\ce{NaOH}) - \Lambda^\circ(\ce{NaCl})$. The $\ce{Na+}$ and $\ce{Cl-}$ terms cancel.

$149.8 + 249.2 - 126.4 =$ **272.6 S cm² mol⁻¹**
:::

:::question{title="8. Dissociation constant" exam="JEE Main level"}
A 0.01 M solution of a weak monobasic acid HA has $\Lambda_m$ = 39.0 S cm² mol⁻¹. Given $\lambda^\circ(\ce{H+})$ = 349.6 and $\lambda^\circ(\ce{A-})$ = 40.4 S cm² mol⁻¹, find $\alpha$ and $K_a$.

---

$\Lambda_m^\circ = 349.6 + 40.4 = 390.0$, so $\alpha = 39.0/390.0 = 0.10$.

$K_a = \dfrac{c\alpha^2}{1 - \alpha} = \dfrac{0.01 \times 0.01}{0.9}$, so **$\alpha$ = 0.10 and $K_a \approx 1.1 \times 10^{-4}$ mol L⁻¹**.
:::

## Electrolysis and batteries

:::question{title="9. Electrolysis of Na2SO4" exam="JEE Main level"}
Dilute aqueous $\ce{Na2SO4}$ is electrolysed between Pt electrodes and 0.2 F of charge is passed. Name the gas at each electrode and find the moles of each.

---

Cathode: water (−0.83 V) is reduced before $\ce{Na+}$ (−2.71 V): $\ce{2H2O + 2e- -> H2 + 2OH-}$. Anode: water (1.23 V) is oxidised before $\ce{SO4^2-}$ (1.96 V): $\ce{2H2O -> O2 + 4H+ + 4e-}$.

0.2 mol e⁻ gives **0.10 mol $\ce{H2}$ at the cathode and 0.05 mol $\ce{O2}$ at the anode**.
:::

:::question{title="10. Lead storage battery" exam="NEET level"}
While a lead storage battery is discharging, which substance forms on both electrodes, and what happens to the concentration of the sulphuric acid?

---

Overall:
$$\begin{aligned} & \ce{Pb + PbO2 + 2H2SO4} \\ & \ce{-> 2PbSO4 + 2H2O} \end{aligned}$$
**$\ce{PbSO4}$ forms on both electrodes**, and since $\ce{H2SO4}$ is used up and water forms, **the acid concentration falls**.
:::
