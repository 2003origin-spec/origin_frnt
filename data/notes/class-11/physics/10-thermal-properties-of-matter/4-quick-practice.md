---
title: "Thermal Properties of Matter: Quick Practice"
type: practice
chapter: c11.physics.thermal-properties-of-matter
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. Ignore heat lost to the surroundings unless told.

## Temperature and expansion

:::question{title="1. Faulty thermometer" exam="NEET level"}
A badly marked thermometer reads 5° in melting ice and 95° in steam at 1 atm. Its scale is uniform. What is the true Celsius temperature when it reads 41°?

---

$\dfrac{41 - 5}{95 - 5} = \dfrac{t_C}{100}$, so $\dfrac{36}{90} = \dfrac{t_C}{100}$ and $t_C =$ **40 °C**.
:::

:::question{title="2. Hole in a hot plate" exam="NEET level"}
A copper plate has a circular hole of diameter 2.00 cm at 20 °C. The plate is heated to 220 °C. Does the hole get bigger or smaller, and by how much? ($\alpha_l = 1.7 \times 10^{-5}$ K⁻¹)

---

The hole expands like copper. $\Delta d = d\,\alpha_l\,\Delta T = 2.00 \times 1.7 \times 10^{-5} \times 200 = 6.8 \times 10^{-3}$ cm. The hole gets **bigger by 0.068 mm** (new diameter 2.0068 cm).
:::

:::question{title="3. Clamped steel rod" exam="JEE Main level"}
A steel rod of cross-section 2 cm² is clamped between two rigid walls. Its temperature rises by 50 °C. Find the thermal stress and the force on each wall. ($\alpha_l = 1.2 \times 10^{-5}$ K⁻¹, $Y = 2 \times 10^{11}$ N m⁻²)

---

Stress $= Y\alpha_l\Delta T = 2 \times 10^{11} \times 1.2 \times 10^{-5} \times 50 =$ **1.2 × 10⁸ N m⁻²**.

Force $=$ stress $\times A = 1.2 \times 10^8 \times 2 \times 10^{-4} =$ **2.4 × 10⁴ N**. The length of the rod does not matter.
:::

## Calorimetry and latent heat

:::question{title="4. Ice to warm water" exam="NEET level"}
How much heat turns 2 kg of ice at −10 °C into water at 20 °C? ($s_{ice} = 2100$ J kg⁻¹ K⁻¹, $s_{water} = 4200$ J kg⁻¹ K⁻¹, $L_f = 3.34 \times 10^5$ J kg⁻¹)

---

Warm the ice to 0 °C: $2 \times 2100 \times 10 = 42\,000$ J.

Melt it: $2 \times 3.34 \times 10^5 = 668\,000$ J.

Warm the water to 20 °C: $2 \times 4200 \times 20 = 168\,000$ J.

Total $=$ **8.78 × 10⁵ J**.
:::

:::question{title="5. Does all the ice melt?" exam="JEE Main level"}
100 g of ice at 0 °C is dropped into 200 g of water at 30 °C. Ignore the container. Find the final temperature and the mass of ice left. ($s_{water} = 4200$ J kg⁻¹ K⁻¹, $L_f = 3.36 \times 10^5$ J kg⁻¹)

---

Heat the water can give by cooling to 0 °C: $0.2 \times 4200 \times 30 = 25\,200$ J.

Heat needed to melt all the ice: $0.1 \times 3.36 \times 10^5 = 33\,600$ J. That is more, so not all the ice melts.

Ice melted $= \dfrac{25\,200}{3.36 \times 10^5} = 0.075$ kg $= 75$ g. Final temperature **0 °C**, with **25 g of ice left**.
:::

## Conduction

:::question{title="6. Heat through a rod" exam="NEET level"}
A copper rod 0.5 m long with cross-section 4 cm² has its ends at 100 °C and 0 °C. Its sides are insulated. Find the rate of heat flow in the steady state. ($K = 400$ W m⁻¹ K⁻¹)

---

$H = \dfrac{KA\,\Delta T}{L} = \dfrac{400 \times 4 \times 10^{-4} \times 100}{0.5} =$ **32 W**.
:::

:::question{title="7. Two rods in series" exam="JEE Main level"}
Rods P and Q have the same length and cross-section. Their conductivities are $K$ and $2K$. They are joined end to end. The free end of P is at 100 °C and the free end of Q at 0 °C. Find the junction temperature and the equivalent conductivity of the combined rod.

---

Same $H$ in both rods: $K(100 - T) = 2K(T - 0)$, so $T = \dfrac{100}{3} \approx$ **33.3 °C**.

$K' = \dfrac{2K_1K_2}{K_1 + K_2} = \dfrac{2 \times K \times 2K}{3K} =$ **4K/3**.
:::

## Radiation and cooling

:::question{title="8. Star temperature" exam="NEET level"}
The radiation from a star is most intense at a wavelength of 500 nm. Estimate its surface temperature. ($b = 2.9 \times 10^{-3}$ m K)

---

$T = \dfrac{b}{\lambda_m} = \dfrac{2.9 \times 10^{-3}}{500 \times 10^{-9}} =$ **5800 K**.
:::

:::question{title="9. Bigger but cooler" exam="NEET level"}
Sphere A (radius $r$) and sphere B (radius $2r$) are both perfect blackbodies. A is at absolute temperature $T$ and B at $T/2$. Find the ratio of the power emitted by B to that emitted by A.

---

$H = A\sigma T^4$ with area $\propto r^2$. So $\dfrac{H_B}{H_A} = \dfrac{(2r)^2}{r^2} \times \left(\dfrac{1}{2}\right)^4 = \dfrac{4}{16} =$ **1 : 4**.
:::

:::question{title="10. Newton's law of cooling" exam="JEE Main level"}
A body cools from 70 °C to 60 °C in 5 minutes. The room is at 20 °C. Using the average-temperature method, how long will it take to cool from 60 °C to 50 °C?

---

First step: average 65 °C, excess 45 °C. $\dfrac{10}{5} = K \times 45$, so $K = \dfrac{2}{45}$ per minute.

Second step: average 55 °C, excess 35 °C. $\dfrac{10}{t} = \dfrac{2}{45} \times 35$, so $t = \dfrac{450}{70} \approx$ **6.4 min**. It takes longer because the body is closer to room temperature.
:::
