---
title: "Electrochemistry: Short Notes"
type: short_notes
chapter: c12.chemistry.electrochemistry
order: 2
---

## 1. Two kinds of electrochemical cell

- **Galvanic (voltaic) cell:** a spontaneous redox reaction gives electrical energy. The Gibbs energy of the reaction becomes electrical work.
- **Electrolytic cell:** an outside voltage drives a **non-spontaneous** reaction.

| Feature | Galvanic | Electrolytic |
| --- | --- | --- |
| Energy change | Chemical → electrical | Electrical → chemical |
| Reaction | Spontaneous | Non-spontaneous |
| Anode sign | Negative | Positive |
| Cathode sign | Positive | Negative |

In **both** cells oxidation happens at the anode and reduction at the cathode. Only the signs change.

**The Daniell cell experiment (NCERT Fig. 2.2):** the cell gives 1.1 V. Apply an opposing outside voltage $E_{ext}$:
- $E_{ext} < 1.1$ V: normal cell. Zn dissolves, Cu deposits, electrons go Zn → Cu.
- $E_{ext} = 1.1$ V: no current, no reaction.
- $E_{ext} > 1.1$ V: the reaction reverses (Zn deposits, Cu dissolves). It is now an electrolytic cell.

## 2. Galvanic cells and electrode potential

- Daniell cell reaction:
$$\begin{aligned} & \ce{Zn(s) + Cu^2+(aq)} \\ & \ce{-> Zn^2+(aq) + Cu(s)} \end{aligned}$$
- It is the sum of two half-reactions: reduction $\ce{Cu^2+ + 2e- -> Cu}$ (Cu electrode) and oxidation $\ce{Zn -> Zn^2+ + 2e-}$ (Zn electrode). Each half is a **half-cell** or **redox couple**.
- The two solutions are joined by a **salt bridge**. If both electrodes dip in the same solution, no salt bridge is needed.
- **Electrode potential:** the potential difference between an electrode and its electrolyte. When every species is at unit concentration it is the **standard electrode potential**, $E^\circ$. (IUPAC: standard electrode potentials are reduction potentials.)
- **Cell notation:** anode on the left, cathode on the right; a single line $|$ between metal and solution; a double line $||$ for the salt bridge.
$$\ce{Cu(s) | Cu^2+(aq) || Ag+(aq) | Ag(s)}$$
- **emf:** the cell potential when **no current** is drawn. $E_{cell} = E_{right} - E_{left}$, which comes out positive under this convention.

## 3. Standard hydrogen electrode (SHE)

- One electrode's potential can't be measured alone. The SHE, $\ce{Pt(s) | H2(g) | H+(aq)}$, is given $E^\circ = 0$ **at all temperatures**.
- Build: platinum coated with platinum black, dipped in acid, pure $\ce{H2}$ bubbled through. $\ce{H2}$ at **1 bar**, $\ce{H+}$ at **1 M**.
- Put the SHE on the left (anode) and the test half-cell on the right. The measured emf is then the $E^\circ$ of the test half-cell.
- $\ce{Cu^2+/Cu}$ = +0.34 V: $\ce{Cu^2+}$ is reduced more easily than $\ce{H+}$. So **Cu does not dissolve in HCl**. In nitric acid Cu is oxidised by the **nitrate ion**, not by $\ce{H+}$.
- $\ce{Zn^2+/Zn}$ = −0.76 V: $\ce{H+}$ can oxidise zinc, so zinc dissolves in acids and gives $\ce{H2}$.

## 4. Reading the $E^\circ$ table

- Going **down** the table, $E^\circ$ falls: the species on the left get weaker as **oxidising** agents and those on the right get stronger as **reducing** agents.
- $\ce{F2}$ (2.87 V) is the strongest oxidising agent; Li (−3.05 V) is the strongest reducing agent in water.
- A metal with lower $E^\circ$ displaces one with higher $E^\circ$ from its salt solution (Zn displaces Cu). Exception: very reactive metals such as Na and K react with the water instead.

## 5. Types of electrodes (all from NCERT examples)

| Type | Example |
| --- | --- |
| Metal in its own ions | $\ce{Zn | Zn^2+}$, $\ce{Cu | Cu^2+}$ |
| Gas electrode on inert Pt | $\ce{Pt | H2 | H+}$ |
| Inert Pt in a redox couple | $\ce{Pt | Br2 | Br-}$ |
| Metal with its insoluble salt | $\ce{Ag | AgCl | Cl-}$ (0.22 V) |

Inert electrodes (Pt, Au) only give a surface for the reaction and conduct electrons. Other reference electrodes, such as the calomel electrode, are exam extra: the syllabi list "different types of electrodes", but NCERT does not cover calomel.

## 6. Nernst equation

- For $\ce{M^{n+} + ne- -> M}$:
$$E = E^\circ - \frac{RT}{nF}\ln\frac{1}{[\ce{M^{n+}}]}$$
- For the Daniell cell at 298 K:
$$E_{cell} = 1.1 - \frac{0.059}{2}\log\frac{[\ce{Zn^2+}]}{[\ce{Cu^2+}]}$$
- So $E_{cell}$ **rises** when $[\ce{Cu^2+}]$ rises and **falls** when $[\ce{Zn^2+}]$ rises.
- Use the **same $n$** for both electrodes. For $\ce{Ni + 2Ag+ -> Ni^2+ + 2Ag}$, $n = 2$ and $Q = [\ce{Ni^2+}]/[\ce{Ag+}]^2$.
- As the cell runs, $Q$ grows and $E_{cell}$ falls. At equilibrium $E_{cell} = 0$ and $Q = K_c$.

## 7. Gibbs energy and equilibrium

- Maximum (reversible) electrical work = decrease in Gibbs energy: $\Delta_r G = -nFE_{cell}$.
- Spontaneous reaction: $E_{cell} > 0$ and $\Delta_r G < 0$.
- $\Delta_r G^\circ = -nFE^\circ_{cell} = -RT\ln K$. So $E^\circ$ gives $K$ even when $K$ is too large to measure directly. Daniell cell: $K_c = 2 \times 10^{37}$ at 298 K.
- NCERT Example 2.3: $\Delta_r G^\circ = -2 \times 96487 \times 1.1 = -212.27$ kJ mol⁻¹. (The J value printed in the book, −21227 J mol⁻¹, looks like a small typo: it should read about −212270 J mol⁻¹. The kJ value is correct.)

## 8. Metallic vs electrolytic conduction

| | Metallic (electronic) | Electrolytic (ionic) |
| --- | --- | --- |
| Carriers | Electrons | Ions |
| Chemical change | None | Yes, at the electrodes |
| On heating | Conductance **falls** | Conductivity **rises** |

- Ionic conductivity depends on: the nature of the electrolyte, ion size and solvation, the solvent and its viscosity, concentration and temperature.
- Pure water conducts very slightly ($\kappa = 3.5 \times 10^{-5}$ S m⁻¹) because of about $10^{-7}$ M $\ce{H+}$ and $\ce{OH-}$.
- Superconductors have zero resistivity (metals at 0–15 K; some ceramics and mixed oxides up to about 150 K).

## 9. Measuring conductivity

- DC would change the solution's composition, so use **AC** (550–5000 Hz). The solution sits in a **conductivity cell** with two platinised Pt electrodes.
- Find the cell constant with a **KCl** solution of known $\kappa$: $G^* = R\kappa$.
- Measure $R$ on a Wheatstone bridge ($R_2 = R_1R_4/R_3$ at balance) or a conductivity meter. Then $\kappa = G^*/R$ and $\Lambda_m = \kappa/c$.

## 10. Effect of dilution

- **Conductivity $\kappa$ always falls** on dilution, for strong and weak electrolytes: fewer ions per unit volume.
- **Molar conductivity $\Lambda_m$ rises** on dilution. $\Lambda_m = \kappa V$, and the volume $V$ holding 1 mol grows faster than $\kappa$ falls.
- At $c \to 0$, $\Lambda_m$ becomes the **limiting molar conductivity** $\Lambda_m^\circ$.
- **Strong electrolyte (KCl):** $\Lambda_m$ rises slowly; $\Lambda_m$ vs $\sqrt c$ is a straight line. Extrapolate to $c = 0$ to get $\Lambda_m^\circ$.
- **Weak electrolyte (acetic acid):** $\Lambda_m$ rises **steeply** at low concentration, because the degree of dissociation increases. The curve can't be extrapolated, so $\Lambda_m^\circ$ comes from **Kohlrausch's law**.

## 11. Kohlrausch's law

- Kohlrausch noticed $\Lambda_m^\circ(\ce{KX}) - \Lambda_m^\circ(\ce{NaX}) \approx 23.4$ S cm² mol⁻¹ for any X. So each ion adds its own fixed share.
- **Law:** $\Lambda_m^\circ$ of an electrolyte is the sum of the contributions of its cations and anions.
- **Uses:** $\Lambda_m^\circ$ from ion values; $\Lambda_m^\circ$ of a weak electrolyte from strong ones; then $\alpha$ and $K_a$.
$$\begin{aligned} \Lambda_m^\circ(\ce{HAc}) = {} & \Lambda_m^\circ(\ce{HCl}) + \Lambda_m^\circ(\ce{NaAc}) \\ & - \Lambda_m^\circ(\ce{NaCl}) \end{aligned}$$
NCERT value: 390.5 S cm² mol⁻¹ for acetic acid.

## 12. Electrolysis

- **Molten NaCl:** Na at the cathode, $\ce{Cl2}$ at the anode.
- **Aqueous NaCl:** $\ce{H2}$ at the cathode (water is reduced, −0.83 V beats $\ce{Na+}$, −2.71 V). At the anode water (1.23 V) should win over $\ce{Cl-}$ (1.36 V), but **overpotential of oxygen** makes $\ce{Cl2}$ form. NaOH stays in solution.
- **$\ce{H2SO4}$:** dilute gives $\ce{O2}$ at the anode; concentrated gives $\ce{S2O8^2-}$ (peroxodisulphate, 1.96 V).
- **Reactive electrodes take part:** $\ce{CuSO4}$ with Cu electrodes: the Cu anode dissolves and pure Cu deposits on the cathode. This is how copper is refined.
- Na and Mg come from electrolysis of **fused chlorides**; Al from $\ce{Al2O3}$ with **cryolite**.
- **Faraday's laws:** (1) the amount of reaction at an electrode is proportional to the charge passed; (2) for the same charge, the amounts liberated are proportional to their equivalent weights (atomic mass ÷ electrons per ion). 1 mol $\ce{Mg^2+}$ needs 2F; 1 mol $\ce{Al^3+}$ needs 3F.

## 13. Batteries

**Primary:** the reaction happens only once; a dead cell can't be reused. **Secondary:** recharged by passing current the opposite way, for many cycles.

**Dry cell (Leclanché cell, primary):** the zinc container is the anode; the cathode is a graphite rod in $\ce{MnO2}$ + carbon; paste of $\ce{NH4Cl}$ and $\ce{ZnCl2}$. About 1.5 V. Mn goes from +4 to +3. The $\ce{NH3}$ formed complexes $\ce{Zn^2+}$ as $\ce{[Zn(NH3)4]^2+}$.
$$\ce{Zn -> Zn^2+ + 2e-}$$
$$\begin{aligned} & \ce{MnO2 + NH4+ + e-} \\ & \ce{-> MnO(OH) + NH3} \end{aligned}$$

**Mercury cell** (hearing aids, watches): anode Zn–Hg amalgam; cathode a paste of HgO and carbon; electrolyte a paste of KOH and ZnO. About 1.35 V, and it stays **constant** because the overall reaction has no ion whose concentration changes:
$$\begin{aligned} & \ce{Zn(Hg) + HgO(s)} \\ & \ce{-> ZnO(s) + Hg(l)} \end{aligned}$$

**Lead storage battery** (cars, inverters): Pb anode, grid of Pb packed with $\ce{PbO2}$ as cathode, **38% $\ce{H2SO4}$**. On discharge:
$$\begin{aligned} & \ce{Pb + SO4^2-} \\ & \ce{-> PbSO4 + 2e-} \end{aligned}$$
$$\begin{aligned} & \ce{PbO2 + SO4^2- + 4H+ + 2e-} \\ & \ce{-> PbSO4 + 2H2O} \end{aligned}$$
$$\begin{aligned} & \ce{Pb + PbO2 + 2H2SO4} \\ & \ce{-> 2PbSO4 + 2H2O} \end{aligned}$$
Charging reverses this: $\ce{PbSO4}$ turns back into Pb (anode) and $\ce{PbO2}$ (cathode).

**Ni–Cd cell:** longer life than the lead cell but costlier. On discharge:
$$\begin{aligned} & \ce{Cd + 2Ni(OH)3} \\ & \ce{-> CdO + 2Ni(OH)2 + H2O} \end{aligned}$$

## 14. Fuel cells

- Galvanic cells that turn the energy of combustion of a fuel ($\ce{H2}$, $\ce{CH4}$, $\ce{CH3OH}$) straight into electricity. Reactants are fed in continuously.
- $\ce{H2}$–$\ce{O2}$ cell (Apollo space programme): gases bubbled through porous carbon electrodes into concentrated aqueous NaOH, with finely divided Pt or Pd as catalyst.
$$\ce{O2 + 2H2O + 4e- -> 4OH-}$$
$$\ce{2H2 + 4OH- -> 4H2O + 4e-}$$
$$\ce{2H2 + O2 -> 2H2O}$$
- About **70%** efficient (thermal plants about **40%**) and pollution free.

## 15. Corrosion

- A metal is oxidised by oxygen to oxides or salts: rusting of iron, tarnishing of silver, green coat on copper and bronze.
- Rusting needs **water and air**. One spot on the iron acts as an **anode**; electrons travel through the metal to another spot, the **cathode**, where $\ce{O2}$ is reduced. $\ce{H+}$ comes from $\ce{H2CO3}$ (dissolved $\ce{CO2}$) and other acidic oxides.
$$\ce{2Fe -> 2Fe^2+ + 4e-}$$
$$\ce{O2 + 4H+ + 4e- -> 2H2O}$$
- Overall $E^\circ_{cell} = 1.23 - (-0.44) = 1.67$ V. $\ce{Fe^2+}$ is then oxidised by air to rust, $\ce{Fe2O3 . xH2O}$.
- **Prevention:** paint or chemicals (e.g. bisphenol); a coating of another metal (Sn, Zn); a **sacrificial electrode** of a more reactive metal (Mg, Zn) that corrodes instead of the object.
