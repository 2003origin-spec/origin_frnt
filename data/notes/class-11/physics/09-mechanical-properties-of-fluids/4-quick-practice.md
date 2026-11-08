---
title: "Mechanical Properties of Fluids: Quick Practice"
type: practice
chapter: c11.physics.mechanical-properties-of-fluids
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise.

## Pressure

:::question{title="1. Bottom of a lake" exam="NEET level"}
A lake is 20 m deep. Find the absolute pressure at its bottom. Take atmospheric pressure $= 1.0 \times 10^5$ Pa and the density of water $= 1000$ kg/m³.

---

$P = P_a + \rho g h = 1.0 \times 10^5 + 1000 \times 10 \times 20 = 1.0 \times 10^5 + 2.0 \times 10^5$, so $P =$ **3.0 × 10⁵ Pa** (about 3 atm).
:::

:::question{title="2. Hydraulic lift" exam="NEET level"}
The pistons of a hydraulic lift have diameters 2 cm and 20 cm. What force on the small piston can hold up a car of mass 1500 kg on the large piston?

---

Area ratio $= \left(\dfrac{20}{2}\right)^2 = 100$. The car's weight is $1500 \times 10 = 15\,000$ N. So $F_1 = \dfrac{15\,000}{100} =$ **150 N**.
:::

:::question{title="3. Oil in a U-tube" exam="JEE Main level"}
A U-tube holds water (density 1000 kg/m³). Oil of density 800 kg/m³ is poured into one arm until the oil column is 10 cm long. How much higher is the oil's top surface than the water's top surface in the other arm?

---

At the level of the oil-water interface, the pressure is the same in both arms: $800 \times 10 = 1000 \times h$, so the water stands $h = 8$ cm above that level in the other arm. The oil stands 10 cm above it. Difference $= 10 - 8 =$ **2 cm** (oil higher).
:::

## Fluid flow

:::question{title="4. Narrowing pipe" exam="NEET level"}
Water flows at 1 m/s through a pipe of radius 2 cm. The pipe narrows to a radius of 1 cm. Find the speed in the narrow part.

---

$A_1 v_1 = A_2 v_2$, so $v_2 = v_1 \left(\dfrac{r_1}{r_2}\right)^2 = 1 \times 4 =$ **4 m/s**.
:::

:::question{title="5. Hole in a tank" exam="NEET level"}
An open tank has a small hole of area 2 cm² at a depth of 5 m below the water surface. Find the speed of the water coming out and the volume that flows out per second.

---

$v = \sqrt{2gh} = \sqrt{2 \times 10 \times 5} =$ **10 m/s**.

Flow rate $= Av = 2 \times 10^{-4} \times 10 = 2 \times 10^{-3}$ m³/s $=$ **2 litres per second**.
:::

:::question{title="6. Pressure in a horizontal pipe" exam="JEE Main level"}
Water flows through a horizontal pipe. At point A the speed is 2 m/s and the pressure is $1.5 \times 10^5$ Pa. At point B the cross-section is half that at A. Find the pressure at B.

---

Continuity: $v_B = 2 \times 2 = 4$ m/s. Same height, so
$$P_B = P_A - \tfrac12\rho(v_B^2 - v_A^2)$$
$P_B = 1.5 \times 10^5 - \tfrac12 \times 1000 \times (16 - 4) = 1.5 \times 10^5 - 6000 =$ **1.44 × 10⁵ Pa**.
:::

## Viscosity

:::question{title="7. Terminal velocity" exam="NEET level"}
A steel ball of radius 3 mm and density 8000 kg/m³ falls through a liquid of density 1000 kg/m³ and viscosity 1.4 Pa s. Find its terminal velocity.

---

$v_t = \dfrac{2a^2(\rho - \sigma)g}{9\eta} = \dfrac{2 \times (3 \times 10^{-3})^2 \times 7000 \times 10}{9 \times 1.4}$

Top: $2 \times 9 \times 10^{-6} \times 70\,000 = 1.26$. Bottom: $12.6$. So $v_t =$ **0.1 m/s** (10 cm/s).
:::

:::question{title="8. Drops merging" exam="JEE Main level"}
27 identical rain drops, each falling with terminal velocity $v$, join to form one big drop. Find the terminal velocity of the big drop.

---

Volume is conserved: $\tfrac43\pi R^3 = 27 \times \tfrac43\pi r^3$, so $R = 3r$. Since $v_t \propto a^2$, the new terminal velocity $= 3^2 v =$ **9v**.
:::

## Surface tension

:::question{title="9. Soap bubble" exam="NEET level"}
A soap bubble has radius 2 cm. The surface tension of the soap solution is 0.03 N/m. Find (a) the excess pressure inside it, and (b) the work done to blow it up from a very small size (at constant temperature).

---

(a) Two surfaces: $\Delta P = \dfrac{4S}{r} = \dfrac{4 \times 0.03}{0.02} =$ **6 Pa**.

(b) $W = S \times 2 \times 4\pi r^2 = 0.03 \times 8\pi \times 4 \times 10^{-4} = 9.6\pi \times 10^{-5}$ J, which is about **3.0 × 10⁻⁴ J**.
:::

:::question{title="10. Short capillary" exam="JEE Main level"}
Water has surface tension 0.07 N/m, density 1000 kg/m³ and angle of contact 0° with clean glass. (a) How high does water rise in a glass tube of radius 0.5 mm? (b) If the tube sticks out only 2 cm above the water, what happens, and what is the radius of curvature of the meniscus?

---

(a) $h = \dfrac{2S}{\rho g a} = \dfrac{2 \times 0.07}{1000 \times 10 \times 5 \times 10^{-4}} = \dfrac{0.14}{5} = 0.028$ m $=$ **2.8 cm**.

(b) The water does **not** overflow. It rises to the top (2 cm) and the meniscus flattens. With $hR = \dfrac{2S}{\rho g}$, $R = \dfrac{0.14}{1000 \times 10 \times 0.02} = 7 \times 10^{-4}$ m $=$ **0.7 mm** (bigger than the tube radius of 0.5 mm).
:::
