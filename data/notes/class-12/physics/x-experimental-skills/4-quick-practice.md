---
title: "Experimental Skills: Quick Practice"
type: practice
chapter: c12.physics.experimental-skills
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise.

## Vernier calipers and screw gauge

:::question{title="1. Vernier with positive zero error" exam="NEET level"}
In a vernier calipers, 1 MSD = 1 mm and 10 VSD = 9 MSD. With the jaws closed, the vernier zero is to the right of the main-scale zero and the 4th vernier mark lines up. Measuring a rod, the main scale reads 31 mm and the 6th vernier mark lines up. Find the diameter of the rod.

---

LC = 1 mm ÷ 10 = 0.1 mm. Zero error = $+4 \times 0.1 = +0.4$ mm.

Observed = $31 + 6 \times 0.1 = 31.6$ mm. Corrected = $31.6 - 0.4 =$ **31.2 mm** (3.12 cm).
:::

:::question{title="2. Vernier with negative zero error" exam="JEE Main level"}
A vernier has 20 VSD = 19 MSD, with 1 MSD = 1 mm. With the jaws closed, the vernier zero is to the left of the main-scale zero and the 15th vernier mark lines up. An object gives a main-scale reading of 25 mm with the 8th vernier mark lining up. Find its true length.

---

LC = 1 mm ÷ 20 = 0.05 mm. Zero error $= -(20 - 15) \times 0.05 = -0.25$ mm.

Observed = $25 + 8 \times 0.05 = 25.40$ mm. Corrected = $25.40 - (-0.25) =$ **25.65 mm**.
:::

:::question{title="3. Screw gauge" exam="NEET level"}
A screw gauge has pitch 0.5 mm and 50 circular divisions. With the faces touching, the 3rd circular division is on the reference line and the circular-scale zero is below the line. For a wire, the linear scale reads 2.5 mm and the 32nd circular division is on the line. Find the diameter.

---

LC = 0.5 ÷ 50 = 0.01 mm. Zero error = $+3 \times 0.01 = +0.03$ mm (the line reads 3 divisions past zero, so the error is positive).

Observed = $2.5 + 32 \times 0.01 = 2.82$ mm. Corrected = $2.82 - 0.03 =$ **2.79 mm**.
:::

## Errors and mechanics

:::question{title="4. Error in g" exam="NEET level"}
A pendulum's length is 100.0 cm, measured to 1 mm. The time for 20 oscillations is 40 s, measured with a watch of resolution 1 s. Find the percentage error in $g$.

---

$\dfrac{\Delta g}{g} = \dfrac{\Delta L}{L} + 2\dfrac{\Delta T}{T}$, and $\dfrac{\Delta T}{T} = \dfrac{\Delta t}{t} = \dfrac{1}{40}$.

$= \dfrac{0.1}{100} + 2 \times \dfrac{1}{40} = 0.1\% + 5\% =$ **5.1%**.
:::

:::question{title="5. Searle's error" exam="JEE Main level"}
In Searle's experiment the load, length and extension are each measured with a 1% error, and the diameter with a 0.5% error. Find the maximum percentage error in $Y$.

---

$Y = \dfrac{MgL}{\pi r^2 l}$, with $g$ taken as exact. Since $r = D/2$, the relative error in $r$ is the same as in $D$: 0.5%.

$\dfrac{\Delta Y}{Y} = 1\% + 1\% + 2 \times 0.5\% + 1\% =$ **4%**.
:::

## Sound and electricity

:::question{title="6. Resonance tube" exam="JEE Main level"}
With a 512 Hz fork, the first and second resonances occur at 15.0 cm and 48.0 cm. Find the speed of sound and the end correction.

---

$v = 2\nu(l_2 - l_1) = 2 \times 512 \times 0.330 \approx$ **338 m/s**.

$e = \dfrac{l_2 - 3l_1}{2} = \dfrac{48.0 - 45.0}{2} =$ **1.5 cm**.
:::

:::question{title="7. Metre bridge" exam="JEE Main level"}
A wire of length 1.0 m and diameter 0.50 mm is in the left gap of a metre bridge, and 3 Ω is in the right gap. The null point is 40.0 cm from the left end. Find the resistivity of the wire. (Take $\pi = 3.14$.)

---

$X = \dfrac{3 \times 40}{60} = 2.0\ \Omega$. Radius $r = 0.25$ mm $= 2.5 \times 10^{-4}$ m.

$\rho = \dfrac{X\pi r^2}{L} = \dfrac{2.0 \times 3.14 \times 6.25 \times 10^{-8}}{1.0} \approx$ **3.9 × 10⁻⁷ Ω m**.
:::

:::question{title="8. Half deflection" exam="JEE Main level"}
In the half-deflection method, a 2.0 V cell (negligible internal resistance) and $R = 5000\ \Omega$ give a deflection of 30 divisions. A shunt $S = 50\ \Omega$ brings it down to 15 divisions. Find $G$ and the figure of merit.

---

$G = \dfrac{RS}{R - S} = \dfrac{5000 \times 50}{4950} \approx$ **50.5 Ω**.

$k = \dfrac{E}{(R + G)\theta} = \dfrac{2.0}{5050.5 \times 30} \approx$ **1.3 × 10⁻⁵ A/div**.
:::

## Optics (graphs)

:::question{title="9. Lens u–v graph" exam="NEET level"}
For a convex lens forming real images, a student plots $|v|$ against $|u|$. The curve meets the line $|v| = |u|$ at (40 cm, 40 cm). Find the focal length, and $|v|$ when $|u| = 60$ cm.

---

Object and image distances are equal at $2f$, so $2f = 40$ cm and $f =$ **20 cm**.

$\dfrac{1}{|v|} = \dfrac{1}{20} - \dfrac{1}{60} = \dfrac{2}{60}$, so $|v| =$ **30 cm**.
:::

:::question{title="10. Prism graph" exam="NEET level"}
The $\delta$–$i$ graph for a prism has its lowest point at $i = 45^\circ$, $\delta = 30^\circ$. Find the angle of the prism and its refractive index.

---

At minimum deviation $i = e$, so $2i = A + \delta_m$: $A = 90^\circ - 30^\circ =$ **60°**.

$n = \dfrac{\sin 45^\circ}{\sin 30^\circ} = \sqrt2 \approx$ **1.41**.
:::
