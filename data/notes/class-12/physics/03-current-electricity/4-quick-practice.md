---
title: "Current Electricity: Quick Practice"
type: practice
chapter: c12.physics.current-electricity
order: 4
---

Try each question first, then tap **Show answer**. Take $e = 1.6 \times 10^{-19}$ C and $m_e = 9.1 \times 10^{-31}$ kg (and $g = 10$ m/s² if needed) unless the question says otherwise.

## Drift and resistance

:::question{title="1. Thick and thin wire" exam="NEET level"}
Two copper wires of diameters 1 mm and 2 mm are joined end to end, and a steady current flows through them. Find the ratio of the drift speed in the thin wire to that in the thick wire.

---

The same current $I$ flows through both, and $v_d = \dfrac{I}{neA}$ with the same $n$. So $v_d \propto \dfrac{1}{A} \propto \dfrac{1}{d^2}$.

$\dfrac{v_{thin}}{v_{thick}} = \left(\dfrac{2}{1}\right)^2 =$ **4 : 1**.
:::

:::question{title="2. Stretched wire" exam="NEET level"}
A wire of resistance 10 Ω is stretched uniformly to twice its length. Its volume does not change. Find its new resistance and the change in its resistivity.

---

Length doubles and area halves, so $R' = \rho\,\dfrac{2l}{A/2} = 4R =$ **40 Ω**. Resistivity depends only on the material and temperature, so it **does not change**.
:::

:::question{title="3. Relaxation time in copper" exam="JEE Main level"}
Copper has resistivity $1.7 \times 10^{-8}$ Ω m and $8.5 \times 10^{28}$ free electrons per m³. Estimate the relaxation time of its electrons.

---

From $\rho = \dfrac{m}{ne^2\tau}$, $\tau = \dfrac{m}{ne^2\rho}$.

$ne^2\rho = 8.5 \times 10^{28} \times 2.56 \times 10^{-38} \times 1.7 \times 10^{-8} \approx 3.7 \times 10^{-17}$

$\tau = \dfrac{9.1 \times 10^{-31}}{3.7 \times 10^{-17}} \approx$ **2.5 × 10⁻¹⁴ s**.
:::

## Temperature and power

:::question{title="4. Hot wire" exam="NEET level"}
A metal wire has a resistance of 20 Ω at 20 °C. Its temperature coefficient of resistance is $4.0 \times 10^{-3}$ °C⁻¹. Find its resistance at 70 °C.

---

$R = R_0[1 + \alpha(T - T_0)] = 20\,[1 + 4.0 \times 10^{-3} \times 50] = 20 \times 1.2 =$ **24 Ω**.
:::

:::question{title="5. Sending power" exam="NEET level"}
A workshop needs 10 kW. It is supplied through cables of total resistance 0.5 Ω. Find the power lost in the cables if the voltage at the workshop is (a) 250 V, (b) 2500 V.

---

(a) $I = P/V = 10\,000/250 = 40$ A, so $P_c = I^2R_c = 1600 \times 0.5 =$ **800 W**.

(b) $I = 4$ A, so $P_c = 16 \times 0.5 =$ **8 W**. Ten times the voltage cuts the loss 100 times.
:::

## Cells

:::question{title="6. Terminal voltage" exam="NEET level"}
A battery of emf 12 V and internal resistance 0.5 Ω is connected to a 5.5 Ω resistor. Find the current and the terminal voltage.

---

$I = \dfrac{\varepsilon}{R + r} = \dfrac{12}{6} =$ **2 A**.

$V = \varepsilon - Ir = 12 - 2 \times 0.5 =$ **11 V** (check: $IR = 2 \times 5.5 = 11$ V).
:::

:::question{title="7. One cell the wrong way" exam="JEE Main level"}
Three cells, each of emf 1.5 V and internal resistance 0.5 Ω, are joined in series, but one of them is connected the wrong way round. The string is connected to a 2.5 Ω resistor. Find the current.

---

The reversed cell's emf is subtracted: $\varepsilon_{eq} = 1.5 + 1.5 - 1.5 = 1.5$ V. The internal resistances all add: $r_{eq} = 3 \times 0.5 = 1.5$ Ω.

$I = \dfrac{1.5}{2.5 + 1.5} =$ **0.375 A**.
:::

:::question{title="8. Two cells in parallel" exam="JEE Main level"}
A cell of emf 3 V and internal resistance 1 Ω and a cell of emf 6 V and internal resistance 2 Ω are joined in parallel, positive to positive. Find the emf and internal resistance of the equivalent cell, and the current it drives through a 2 Ω resistor.

---

$\varepsilon_{eq} = \dfrac{\varepsilon_1 r_2 + \varepsilon_2 r_1}{r_1 + r_2} = \dfrac{3 \times 2 + 6 \times 1}{3} =$ **4 V**.

$r_{eq} = \dfrac{1 \times 2}{1 + 2} =$ **2/3 Ω**.

$I = \dfrac{4}{2 + 2/3} = \dfrac{4}{8/3} =$ **1.5 A**.
:::

## Kirchhoff's rules and bridges

:::question{title="9. Two cells, three branches" exam="JEE Main level"}
Three branches are joined in parallel between points A and B:
- branch 1: a 10 V cell in series with 2 Ω;
- branch 2: a 3 V cell in series with 1 Ω;
- branch 3: a 2 Ω resistor.

Both cells have their positive terminals towards A and negligible internal resistance. Find the current in the 2 Ω resistor of branch 3, and the current through the 3 V cell.

---

Let $V = V_A - V_B$. Current flowing out of each cell towards A: $\dfrac{10 - V}{2}$ and $\dfrac{3 - V}{1}$. Current from A to B in branch 3: $\dfrac{V}{2}$.

Junction rule at A: $\dfrac{10 - V}{2} + (3 - V) = \dfrac{V}{2}$, so $10 - V + 6 - 2V = V$ and $V = 4$ V.

Branch 3: $4/2 =$ **2 A** from A to B. The 3 V cell: $3 - 4 = -1$ A, so **1 A** flows **into** its positive terminal (it is being charged). The 10 V cell gives 3 A.
:::

:::question{title="10. Metre bridge" exam="NEET level"}
In a metre bridge, a 6 Ω resistor is in the left gap and an unknown resistor $S$ in the right gap. The null point is 40 cm from the left end. Find $S$.

---

$\dfrac{R}{S} = \dfrac{l}{100 - l}$, so $\dfrac{6}{S} = \dfrac{40}{60}$ and $S = \dfrac{6 \times 60}{40} =$ **9 Ω**.
:::
