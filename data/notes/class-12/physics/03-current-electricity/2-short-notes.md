---
title: "Current Electricity: Short Notes"
type: short_notes
chapter: c12.physics.current-electricity
order: 2
---

## 1. Electric current

- Moving charges make an **electric current**. The current across an area is the **net** charge crossing it per second.
- Current flows from higher to lower potential outside a cell. Electrons in a metal move the other way.
- SI unit: ampere (A). Home appliances draw about 1 A, lightning carries tens of thousands of amperes, and nerve currents are in microamperes.
- Current is a **scalar**. The arrow on a wire only shows the sense of flow; currents do not add like vectors.

:::remember
A steady current needs a **closed circuit** and a source (a cell or battery) that keeps the electric field inside the conductor steady. Without a source, charges at the ends neutralise and the current stops after a very short time.
:::

## 2. Conductors and free electrons

- In metals some electrons are practically **free** to move inside the bulk. In solid conductors the current is carried by these electrons, moving among fixed positive ions.
- In electrolytes and ionised gases, both positive and negative charges move.
- With **no field**, electrons move randomly at high thermal speeds. Equal numbers go each way, so there is **no net current**.

## 3. Ohm's law, resistance and resistivity

- **Ohm's law:** $V \propto I$, so $V = IR$, with $R$ constant.
- $R$ depends on the material **and** the size: doubling the length doubles $R$; halving the area doubles $R$. So $R = \rho l / A$.
- **Resistivity** $\rho$ is a property of the material (and its temperature), not of the shape.
- **Current density** $j = I/A$ (A/m²). Ohm's law in vector form: $\vec j = \sigma \vec E$, where $\sigma = 1/\rho$ is the conductivity.

:::remember
$V = IR$ **defines** resistance for every device. Ohm's law is the stronger claim that the $I$–$V$ graph is a straight line through the origin, so $R$ does not depend on $V$ (NCERT, Points to Ponder).
:::

## 4. Drift velocity and the origin of resistivity

- An electron is accelerated by the field ($a = -eE/m$) only until its next collision with an ion. After a collision it moves off in a random direction.
- **Relaxation time** $\tau$ = average time between collisions.
- Averaging over all electrons gives a **constant** average velocity, the **drift velocity**:

$$\vec v_d = -\frac{e\tau}{m}\vec E$$

- Electrons drift **opposite** to $\vec E$, that is, towards higher potential.
- This simple model gives $\sigma = ne^2\tau/m$, which is exactly Ohm's law, as long as $n$ and $\tau$ do not depend on $E$.

| Speed | Typical value (copper) |
| --- | --- |
| Drift speed $v_d$ (1.5 A, NCERT Ex. 3.1) | about 1 mm/s |
| Thermal speed of atoms (300 K) | about 200 m/s |
| Speed of the electric field along the wire | $3 \times 10^8$ m/s |

:::remember
A bulb lights almost at once although $v_d$ is tiny, because the **electric field** sets up in the whole circuit at nearly the speed of light, and electrons everywhere start drifting together. A large current is possible because $n$ is huge (about $10^{29}$ m⁻³).
:::

**Mobility** $\mu = |v_d|/E = e\tau/m$ (m²/(V s)). It tells how easily a carrier drifts. Carriers are electrons in metals, electrons and positive ions in ionised gases, and positive and negative ions in electrolytes.

## 5. Limits of Ohm's law

Ohm's law is obeyed by many materials, but it is **not** a fundamental law. It fails when:

| Deviation | Example (NCERT) |
| --- | --- |
| $V$ is not proportional to $I$ | Graph bends at large currents |
| $V$–$I$ relation depends on the sign of $V$ | Diode |
| More than one $V$ for the same $I$ | GaAs |

Devices that do not obey Ohm's law (non-ohmic) are widely used in electronics.

## 6. Resistivity of materials

- **Conductors** (metals): $\rho$ from $10^{-8}$ to $10^{-6}$ Ω m.
- **Insulators** (ceramic, rubber, plastics): about $10^{18}$ times the metals' value or more.
- **Semiconductors** (Si, Ge): in between. Their $\rho$ **falls** as temperature rises, and falls sharply when small amounts of suitable impurities are added.

## 7. Temperature dependence of resistivity

Over a limited range, $\rho_T = \rho_0[1 + \alpha(T - T_0)]$.

| Material | How $\rho$ changes on heating | Reason or use |
| --- | --- | --- |
| Metals (Cu) | Increases ($\alpha > 0$) | $\tau$ falls, $n$ almost fixed |
| Nichrome, manganin, constantan | Increases very little | Used in standard resistors |
| Semiconductors, insulators | Decreases | $n$ rises more than $\tau$ falls |

- The reason comes from $\rho = m/(ne^2\tau)$. Heating makes collisions more frequent, so $\tau$ decreases.
- For copper the $\rho$–$T$ graph is a straight line over a range, but it bends a lot well below 0 °C.
- Nichrome is an alloy of nickel, iron and chromium. It is used in heaters and toasters.

## 8. Electrical energy and power

- When charge $\Delta Q$ falls through a potential difference $V$, it loses potential energy $V\,\Delta Q$.
- Because of collisions, this energy does not become kinetic energy of the electrons. It goes to the ions, which vibrate more: the conductor **heats up**. This is the **ohmic loss**.
- Power: $P = VI = I^2R = V^2/R$. The source (for example, the chemical energy of a cell) supplies it.
- **Transmission:** to deliver power $P$ at voltage $V$ through cables of resistance $R_c$, the loss is $P^2R_c/V^2$. So power is sent at very high voltage, and a **transformer** lowers it near homes.

## 9. Cells, emf and internal resistance

- A cell has a positive electrode P and a negative electrode N in an electrolyte.
- **emf** $\varepsilon$ = potential difference between P and N when **no current** flows (open circuit). Despite its name, emf is a potential difference, not a force.
- The electrolyte has a resistance $r$, the **internal resistance**.

| Situation | Terminal voltage $V$ |
| --- | --- |
| Open circuit ($I = 0$) | $V = \varepsilon$ |
| Cell giving current $I$ | $V = \varepsilon - Ir$ |
| Cell being charged by current $I$ | $V = \varepsilon + Ir$ |

- With a load $R$: $I = \varepsilon/(R + r)$. The largest possible current is $\varepsilon/r$, but real cells allow much less to avoid damage.
- $r$ can be ignored when $\varepsilon \gg Ir$. Dry cells have a much higher internal resistance than common electrolytic cells.

## 10. Combinations of cells

- **Series:** emfs add and internal resistances add. A cell joined the wrong way (current leaves it from its − terminal) has its emf **subtracted**, but its $r$ is still **added**.
- **Parallel (+ to +):** $1/r_{eq} = \sum 1/r_i$ and $\varepsilon_{eq}/r_{eq} = \sum \varepsilon_i/r_i$. For identical cells, $\varepsilon_{eq} = \varepsilon$ and $r_{eq} = r/m$.

:::tip
Series cells give a **bigger emf**. Parallel cells give the **same emf** but a **smaller internal resistance**, so more current when the load $R$ is small.
:::

## 11. Kirchhoff's rules

1. **Junction rule:** total current in = total current out (conservation of charge). It also holds at any point on a wire, however the wire is bent.
2. **Loop rule:** the algebraic sum of potential changes around any closed loop is zero (potential has one value at each point).

**Sign rules for walking round a loop:**
- Across a resistor **in** the direction of the assumed current: $-IR$. Against it: $+IR$.
- Across a cell from − to +: $+\varepsilon$. From + to −: $-\varepsilon$.
- If a current comes out negative, it flows opposite to the arrow you drew. The size is still right.

:::example{title="Symmetric cube (NCERT Example 3.5)"}
Twelve 1 Ω resistors form a cube; a 10 V battery is joined across opposite corners. By symmetry, the battery current $3I$ splits equally into the 3 edges at the first corner ($I$ each), and each $I$ splits into two ($I/2$ each) at the next corners. The loop rule gives $\varepsilon = \tfrac52 IR$, so $R_{eq} = \varepsilon/3I = \tfrac56$ Ω, and the battery current is 12 A.
:::

## 12. Wheatstone bridge

- Four resistors in a loop A–B–C–D. Cell across A and C (**battery arm**), galvanometer across B and D (**galvanometer arm**).
- **Balanced** when no current flows in the galvanometer: $R_2/R_1 = R_4/R_3$ (NCERT labels; see the formula sheet).
- Use: put an unknown in one arm, vary a known one till the galvanometer shows **null deflection**, then calculate.
- The **metre bridge** is a practical form of it (named in NCERT; its working is an exam extra, see below).

## 13. Exam extras (in the syllabi, not in this NCERT chapter)

- **Resistors in series and parallel** (from Class 10 NCERT): series $R = R_1 + R_2$; parallel $1/R = 1/R_1 + 1/R_2$. In series the current is the same; in parallel the voltage is the same.
- **Metre bridge** (in both syllabi and in their experimental skills): a 1 m uniform wire forms two arms of the bridge. If the null point is $l$ cm from the left end, $R/S = l/(100 - l)$. Readings are most accurate when the null point is near the middle.
- **Potentiometer:** removed from the rationalised NCERT book and not in the JEE Main 2026 or NEET 2026 syllabus. Skip it unless your coaching material asks for it.
