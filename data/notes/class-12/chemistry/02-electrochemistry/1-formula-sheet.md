---
title: "Electrochemistry: Formula Sheet"
type: formula_sheet
chapter: c12.chemistry.electrochemistry
order: 1
---

Notation as in NCERT: $E^\circ$ = standard electrode potential (a **reduction** potential), $n$ = moles of electrons in the balanced reaction, $F$ = Faraday constant.

## Cell potential

:::formula{title="emf of a galvanic cell"}
$$E_{cell} = E_{right} - E_{left}$$
$$E^\circ_{cell} = E^\circ_{cathode} - E^\circ_{anode}$$
Unit: volt (V). Anode on the **left**, cathode on the right. Both are **reduction** potentials from the table; don't flip the anode's sign before subtracting.

A positive $E^\circ_{cell}$ means the cell reaction is spontaneous as written (under standard conditions).
:::

:::example{title="Daniell cell"}
$$\ce{Zn | Zn^2+ (1 M) || Cu^2+ (1 M) | Cu}$$
$E^\circ_{cell} = 0.34 - (-0.76) = 1.10$ V.
:::

## Nernst equation

:::formula{title="Electrode potential (metal electrode)"}
For $\ce{M^{n+}(aq) + ne- -> M(s)}$:
$$E = E^\circ - \frac{RT}{nF}\ln\frac{1}{[\ce{M^{n+}}]}$$
$R$ = 8.314 J K⁻¹ mol⁻¹, $T$ in kelvin, $F$ = 96487 C mol⁻¹. The solid metal counts as 1.
:::

:::formula{title="Cell potential (general reaction)"}
For $\ce{aA + bB -> cC + dD}$ with $n$ electrons:
$$E_{cell} = E^\circ_{cell} - \frac{RT}{nF}\ln Q$$
$$Q = \frac{[\mathrm{C}]^c[\mathrm{D}]^d}{[\mathrm{A}]^a[\mathrm{B}]^b}$$
Pure solids and liquids count as 1. Strictly, activities should be used; in dilute solution they equal concentrations.
:::

:::formula{title="Nernst equation at 298 K"}
$$E_{cell} = E^\circ_{cell} - \frac{0.059}{n}\log Q$$
$\dfrac{2.303RT}{F} = 0.059$ V at 298 K only. At any other temperature, work out $\dfrac{2.303RT}{F}$ with that $T$ (or use the $\ln$ form above).
:::

:::formula{title="Hydrogen electrode at 1 bar H₂ (298 K)"}
$$E_{\ce{H+/H2}} = -0.059\,\text{pH}$$
From $\ce{H+ + e- -> 1/2 H2}$ with $p_{\ce{H2}}$ = 1 bar. At pH 10 the potential is $-0.59$ V.
:::

:::formula{title="Concentration cell (exam extra)"}
Not in NCERT; it is an application of the Nernst equation, which the JEE Main and NEET syllabi list. Same metal electrode $\ce{M | M^{n+}}$ on both sides, different ion concentrations, 298 K. $c_2$ = concentration at the cathode (right), $c_1$ at the anode (left):
$$E_{cell} = \frac{0.059}{n}\log\frac{c_2}{c_1}$$
$E^\circ_{cell} = 0$. The emf is positive only while $c_2 > c_1$. For an electrode that responds to an **anion** (such as $\ce{Cl-}$), the ratio flips; work it out from the Nernst equation for each electrode.
:::

## Gibbs energy and equilibrium constant

:::formula{title="Gibbs energy of the cell reaction"}
$$\Delta_r G = -nFE_{cell}$$
$$\Delta_r G^\circ = -nFE^\circ_{cell}$$
$F$ in C mol⁻¹ and $E$ in V give $\Delta_r G$ in J mol⁻¹. $E$ is **intensive**; $\Delta_r G$ is **extensive** (it doubles when the equation is doubled, because $n$ doubles).
:::

:::formula{title="Standard Gibbs energy and K"}
$$\Delta_r G^\circ = -RT\ln K$$
$$\Delta_r G^\circ = -2.303RT\log K$$
:::

:::formula{title="E° and equilibrium constant"}
$$E^\circ_{cell} = \frac{2.303RT}{nF}\log K_c$$
At 298 K:
$$E^\circ_{cell} = \frac{0.059}{n}\log K_c$$
It comes from the Nernst equation with $E_{cell} = 0$ at equilibrium.
:::

:::formula{title="Combining two half-reactions (exam extra)"}
Not in NCERT; it follows from $\Delta G^\circ = -nFE^\circ$, which the syllabi include.
To get $E^\circ$ of a third **half**-reaction, add the $\Delta G^\circ$ values, not the $E^\circ$ values:
$$n_3E^\circ_3 = n_1E^\circ_1 + n_2E^\circ_2$$
Example: $\ce{Fe^3+ + 3e- -> Fe}$ from $\ce{Fe^3+/Fe^2+}$ (0.77 V, 1 e⁻) and $\ce{Fe^2+/Fe}$ (−0.44 V, 2 e⁻): $E^\circ = (0.77 - 0.88)/3 \approx -0.037$ V.
:::

## Conductance of solutions

:::formula{title="Resistance and resistivity"}
$$R = \rho\,\frac{l}{A}$$
$R$ in ohm (Ω), $\rho$ = resistivity in Ω m, $l$ = length, $A$ = area of cross-section. $1\ \Omega\ \text{m} = 100\ \Omega\ \text{cm}$.
:::

:::formula{title="Conductance and conductivity"}
$$G = \frac{1}{R} = \kappa\,\frac{A}{l}$$
$$\kappa = \frac{1}{\rho}$$
$G$ in siemens (S = Ω⁻¹ = mho). $\kappa$ in S m⁻¹ (often S cm⁻¹). $1\ \text{S cm}^{-1} = 100\ \text{S m}^{-1}$.
:::

:::formula{title="Cell constant"}
$$G^* = \frac{l}{A} = R\,\kappa$$
$$\kappa = \frac{G^*}{R}$$
Unit of $G^*$: m⁻¹ (or cm⁻¹). Found by measuring $R$ with a KCl solution of known $\kappa$.
:::

:::formula{title="Molar conductivity"}
$$\Lambda_m = \frac{\kappa}{c}$$
$\kappa$ in S m⁻¹ and $c$ in mol m⁻³ give $\Lambda_m$ in S m² mol⁻¹. With $\kappa$ in S cm⁻¹ and molarity $M$ in mol L⁻¹:
$$\Lambda_m = \frac{1000\,\kappa}{M}\ \text{S cm}^2\,\text{mol}^{-1}$$
$1\ \text{S m}^2\text{mol}^{-1} = 10^4\ \text{S cm}^2\text{mol}^{-1}$. Also $\Lambda_m = \kappa V$, where $V$ = volume holding 1 mol of electrolyte.
:::

:::formula{title="Strong electrolytes: Λm and concentration"}
$$\Lambda_m = \Lambda_m^\circ - A\,c^{1/2}$$
Holds for **strong** electrolytes at low concentration. Plot $\Lambda_m$ against $\sqrt c$: a straight line, intercept $\Lambda_m^\circ$, slope $-A$. $A$ depends on the solvent, temperature and electrolyte type (1-1, 2-1, 2-2). Some books link this equation to the Debye–Hückel–Onsager theory (beyond the syllabus; NCERT does not name it).
:::

:::formula{title="Kohlrausch law of independent migration of ions"}
$$\Lambda_m^\circ = \nu_+\lambda_+^\circ + \nu_-\lambda_-^\circ$$
$\nu_+$, $\nu_-$ = number of cations and anions from one formula unit. Example: $\Lambda_m^\circ(\ce{CaCl2}) = \lambda^\circ_{\ce{Ca^2+}} + 2\lambda^\circ_{\ce{Cl-}}$.
:::

:::formula{title="Weak electrolytes: α and Ka"}
$$\alpha = \frac{\Lambda_m}{\Lambda_m^\circ}$$
$$K_a = \frac{c\,\alpha^2}{1 - \alpha}$$
For a weak electrolyte like acetic acid. $\Lambda_m^\circ$ comes from Kohlrausch's law, not from a graph.
:::

## Electrolysis

:::formula{title="Charge passed"}
$$Q = I\,t$$
$Q$ in coulomb, $I$ in ampere, $t$ in **seconds**.
:::

:::formula{title="Faraday constant"}
$$F = N_A \times e = 96487\ \text{C mol}^{-1}$$
Charge on 1 mol of electrons. Use $F \approx 96500$ C mol⁻¹ for rough work.
:::

:::formula{title="Mass deposited (Faraday's first law)"}
$$m = \frac{Q}{nF} \times M$$
$n$ = electrons per ion discharged (2 for $\ce{Cu^2+}$, 3 for $\ce{Al^3+}$), $M$ = molar mass in g mol⁻¹. Moles of electrons $= Q/F$.

Exam extra (not in NCERT): some books write $m = ZIt$, where $Z = M/(nF)$ is the electrochemical equivalent.
:::

:::formula{title="Faraday's second law (cells in series)"}
$$\frac{m_1}{m_2} = \frac{M_1/n_1}{M_2/n_2}$$
Same charge through each cell. $M/n$ is the chemical equivalent weight.
:::

## Values from NCERT

| Electrode | $E^\circ$/V |
| --- | --- |
| $\ce{F2/F-}$ | 2.87 |
| $\ce{O2, H+/H2O}$ | 1.23 |
| $\ce{Ag+/Ag}$ | 0.80 |
| $\ce{Fe^3+/Fe^2+}$ | 0.77 |
| $\ce{Cu^2+/Cu}$ | 0.34 |
| $\ce{H+/H2}$ | 0.00 |
| $\ce{Fe^2+/Fe}$ | −0.44 |
| $\ce{Zn^2+/Zn}$ | −0.76 |
| $\ce{Na+/Na}$ | −2.71 |
| $\ce{Li+/Li}$ | −3.05 |

Limiting ionic molar conductivities $\lambda^\circ$ (S cm² mol⁻¹, NCERT Table 2.4): $\ce{H+}$ 349.6, $\ce{OH-}$ 199.1, $\ce{Na+}$ 50.1, $\ce{K+}$ 73.5, $\ce{Cl-}$ 76.3, $\ce{CH3COO-}$ 40.9.
