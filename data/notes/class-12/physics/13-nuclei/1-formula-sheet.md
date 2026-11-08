---
title: "Nuclei: Formula Sheet"
type: formula_sheet
chapter: c12.physics.nuclei
order: 1
---

## Units and constants (NCERT values)

:::formula{title="Atomic mass unit"}
$$1\ \text{u} = \frac{\text{mass of one } {}^{12}\text{C atom}}{12}$$
$$1\ \text{u} = 1.6605 \times 10^{-27}\ \text{kg}$$
$$1\ \text{u} = 931.5\ \text{MeV}/c^2$$
So 1 u of mass is equivalent to 931.5 MeV of energy.
:::

:::formula{title="Particle masses"}
$m_p = 1.00727$ u, $m_n = 1.00866$ u, $m_e = 0.00055$ u.

Hydrogen **atom** ($m_H$, proton + electron) $= 1.00783$ u. The exercises use $m_H = 1.007825$ u and $m_n = 1.008665$ u.
:::

:::formula{title="Energy units"}
$$1\ \text{eV} = 1.6 \times 10^{-19}\ \text{J}$$
$$1\ \text{MeV} = 1.6 \times 10^{-13}\ \text{J}$$
$$1\ \text{fm} = 10^{-15}\ \text{m}$$
:::

## Composition and size

:::formula{title="Mass number"}
$$A = Z + N$$
$Z$ = atomic number (protons), $N$ = neutron number, $A$ = mass number (nucleons). Nuclide notation: ${}^{A}_{Z}\text{X}$, e.g. ${}^{197}_{79}\text{Au}$ has 79 protons and 118 neutrons.
:::

:::formula{title="Nuclear radius"}
$$R = R_0 A^{1/3}$$
$R_0 = 1.2$ fm $= 1.2 \times 10^{-15}$ m. So $R \propto A^{1/3}$ and volume $\propto R^3 \propto A$. Treats the nucleus as a sphere; $R_0$ is an experimental (average) value.
:::

:::formula{title="Nuclear density"}
$$\rho = \frac{A\,m}{\tfrac43\pi R_0^3 A}$$
$$\rho = \frac{3m}{4\pi R_0^3}$$
$m$ = mass of one nucleon ($\approx 1$ u). $A$ cancels, so $\rho$ is the **same for all nuclei**: about $2.3 \times 10^{17}$ kg m⁻³ (water: $10^3$ kg m⁻³).
:::

## Mass-energy and binding energy

:::formula{title="Mass-energy equivalence"}
$$E = mc^2$$
$E$ in J, $m$ in kg, $c \approx 3 \times 10^8$ m/s. 1 g of matter $\to 9 \times 10^{13}$ J.
:::

:::formula{title="Mass defect"}
$$\Delta M = [Z m_p + (A - Z) m_n] - M$$
Masses in u (or kg); $m_p$, $m_n$ = proton and neutron masses; $M$ = mass of the **nucleus**. $\Delta M$ is always positive: a nucleus is lighter than its separate nucleons.
:::

:::formula{title="Mass defect from atomic masses"}
$$\Delta M = [Z m_H + (A - Z) m_n] - M_{atom}$$
Use this when the data gives **atomic** masses (as the NCERT exercises do). The $Z$ electrons cancel. Never mix $m_p$ with an atomic mass.
:::

:::formula{title="Binding energy"}
$$E_b = \Delta M\,c^2$$
$$E_b\ (\text{MeV}) = \Delta M\ (\text{u}) \times 931.5$$
Energy needed to pull a nucleus apart into free nucleons (= energy released when it forms).
:::

:::formula{title="Binding energy per nucleon"}
$$E_{bn} = \frac{E_b}{A}$$
About 8 MeV for $30 < A < 170$. Peak about 8.75 MeV at $A = 56$ (iron); 7.6 MeV at $A = 238$. Higher $E_{bn}$ = more tightly bound.
:::

## Nuclear reactions and energy

:::formula{title="Q value"}
$$Q = (\Sigma m_{initial} - \Sigma m_{final})\,c^2$$
$$Q = K_{final} - K_{initial}$$
$Q$ in J (or MeV with masses in u times 931.5). $Q > 0$: energy released (exothermic). $Q < 0$: energy must be supplied (endothermic). Use all-nuclear or all-atomic masses, not a mix; with atomic masses the electrons must balance.
:::

:::formula{title="Q from binding energies"}
$$Q = E_{b,\,products} - E_{b,\,reactants}$$
Total binding energies, in MeV. Holds because proton and neutron numbers are conserved. NCERT uses it for fission: $A = 240$ ($E_{bn} = 7.6$) $\to$ two $A = 120$ ($E_{bn} = 8.5$) gives $Q \approx 240 \times 0.9 = 216$ MeV.
:::

:::formula{title="Coulomb barrier (fusion)"}
$$U = \frac{1}{4\pi\varepsilon_0}\,\frac{q_1 q_2}{d}$$
$q_1$, $q_2$ = charges (C), $U$ in J (divide by $1.6 \times 10^{-19}$ for eV). $d$ (m) = distance between centres when the two nuclei just touch (sum of radii). $\dfrac{1}{4\pi\varepsilon_0} = 9 \times 10^9$ N m² C⁻². Two protons: about 400 keV.
:::

:::formula{title="Temperature for fusion (estimate)"}
$$\tfrac32\,k_B T = K$$
$k_B = 1.381 \times 10^{-23}$ J/K, $K$ = average kinetic energy of a particle. Setting $K \approx 400$ keV gives $T \sim 3 \times 10^9$ K. A rough average-energy estimate only.
:::

:::formula{title="Typical energies"}
- Fission of one ${}^{235}$U nucleus: about **200 MeV**.
- p-p cycle (net): $4\,{}^{1}_{1}\text{H} + 2e^- \to {}^{4}_{2}\text{He} + 2\nu + 6\gamma$ releases **26.7 MeV**.
- Fission of 1 kg uranium $\approx 10^{14}$ J; burning 1 kg coal $\approx 10^{7}$ J.
:::

## Radioactive decay: what changes

| Decay | $A$ | $Z$ |
| --- | --- | --- |
| $\alpha$ (emits ${}^{4}_{2}\text{He}$) | $-4$ | $-2$ |
| $\beta^-$ (emits $e^-$ + antineutrino) | same | $+1$ |
| $\beta^+$ (emits $e^+$ + neutrino) | same | $-1$ |
| $\gamma$ (photon) | same | same |

These follow from conservation of charge and nucleon number. NCERT names the three decays but no longer writes these rules out, and the JEE Main 2026 and NEET 2026 syllabi do not list radioactivity at all.

:::formula{title="Decay law (beyond the syllabus)"}
$$N = N_0 e^{-\lambda t}$$
$$T_{1/2} = \frac{\ln 2}{\lambda} = \frac{0.693}{\lambda}$$
$$\tau = \frac{1}{\lambda}$$
$$R = \lambda N$$
$N$ = undecayed nuclei at time $t$, $N_0$ = at $t = 0$, $\lambda$ = decay constant (s⁻¹), $T_{1/2}$ and $\tau$ in s, activity $R$ in Bq (= decays per second). This $R$ is not the nuclear radius.

Removed from the rationalised NCERT chapter and not in the JEE Main 2026 or NEET 2026 syllabus. Only the end-of-chapter table still names $\lambda$, $T_{1/2}$, $\tau$ and activity $R$ (unit Bq). Given here for reference only.
:::
