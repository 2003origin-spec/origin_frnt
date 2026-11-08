---
title: "Magnetism and Matter: Quick Practice"
type: practice
chapter: c12.physics.magnetism-and-matter
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise (no question here needs it). Use $\dfrac{\mu_0}{4\pi} = 10^{-7}$ T m A⁻¹.

## Magnet in a uniform field

:::question{title="1. Finding the moment" exam="NEET level"}
A short bar magnet is placed with its axis at $30^\circ$ to a uniform field of 0.4 T. The torque on it is 0.06 N m. Find its magnetic moment.

---

$\tau = mB\sin\theta$, so $m = \dfrac{0.06}{0.4 \times 0.5} =$ **0.3 A m²** (0.3 J T⁻¹).
:::

:::question{title="2. Work to turn a magnet" exam="NEET level"}
A magnet of moment 2 A m² is in a uniform field of 0.3 T, with $\vec m$ at $60^\circ$ to $\vec B$. How much work is needed to turn it slowly until $\vec m$ points opposite to $\vec B$?

---

$W = mB(\cos\theta_1 - \cos\theta_2) = 0.6\,(\cos 60^\circ - \cos 180^\circ)$

$= 0.6 \times (0.5 + 1) =$ **0.9 J**.
:::

:::question{title="3. Solenoid as a magnet" exam="NEET level"}
A closely wound solenoid has 500 turns, each of area $4\times10^{-4}$ m², and carries 2.5 A. It hangs in a uniform field of 0.2 T, with its axis at $30^\circ$ to the field. Find its magnetic moment, the torque on it and the net force on it.

---

$m = NIA = 500 \times 2.5 \times 4\times10^{-4} =$ **0.5 A m²**.

$\tau = mB\sin 30^\circ = 0.5 \times 0.2 \times 0.5 =$ **0.05 N m**.

The field is uniform, so the net force is **zero**.
:::

## Field of a bar magnet

:::question{title="4. On the equator" exam="NEET level"}
A short bar magnet has magnetic moment 0.8 A m². Find the field at a point 20 cm from its centre on its equatorial line (normal bisector), and give its direction.

---

$B_E = \dfrac{\mu_0}{4\pi}\dfrac{m}{r^3} = 10^{-7} \times \dfrac{0.8}{(0.2)^3}$

$= 10^{-7} \times 100 =$ **$10^{-5}$ T**, pointing **opposite** to $\vec m$ (from the N end towards the S end, parallel to the magnet).
:::

:::question{title="5. Axis vs equator" exam="JEE Main level"}
Point A is on the axis of a short bar magnet at distance $d$ from its centre. Point B is on its equatorial line at distance $2d$. Find $B_A : B_B$.

---

$B_A \propto \dfrac{2m}{d^3}$ and $B_B \propto \dfrac{m}{(2d)^3} = \dfrac{m}{8d^3}$.

Ratio $= 2 \times 8 =$ **16 : 1**.
:::

:::question{title="6. Where the field vanishes" exam="JEE Main level"}
A short bar magnet of moment 0.5 A m² is placed in a uniform field of $10^{-4}$ T, with $\vec m$ pointing **opposite** to the field. Where is the net field zero?

---

On the axis, the magnet's field points along $\vec m$, which is against the outside field, so they can cancel there. (On the equator the magnet's field is opposite to $\vec m$, so it adds to the outside field.)

$10^{-7} \times \dfrac{2 \times 0.5}{r^3} = 10^{-4}$ gives $r^3 = 10^{-3}$ m³.

So $r = 0.1$ m: at **two points on the axis, 10 cm from the centre, one on each side**.
:::

## Magnetic materials

:::question{title="7. Solenoid with a core" exam="NEET level"}
A long solenoid with 500 turns per metre carries 4 A. Its core has $\mu_r = 501$. Find (a) $H$, (b) $M$, (c) $B$ inside, (d) the magnetising current.

---

(a) $H = nI = 500 \times 4 =$ **2000 A/m**.

(b) $\chi = \mu_r - 1 = 500$, so $M = \chi H =$ **$10^6$ A/m**.

(c) $B = \mu_0(H + M) = 4\pi\times10^{-7} \times 1.002\times10^6 \approx$ **1.26 T**.

(d) $I_M = (\mu_r - 1)I = 500 \times 4 =$ **2000 A**.
:::

:::question{title="8. Which kind of material?" exam="JEE Main level"}
A rod of volume $10^{-5}$ m³, placed in a magnetic intensity $H = 400$ A/m, gets a magnetic moment of 2 A m². Find $\chi$ and $\mu_r$, and say what kind of material it is.

---

$M = \dfrac{m}{V} = \dfrac{2}{10^{-5}} = 2\times10^5$ A/m.

$\chi = \dfrac{M}{H} = \dfrac{2\times10^5}{400} =$ **500**, so $\mu_r = 1 + \chi =$ **501**.

$\chi$ is large and positive: **ferromagnetic**.
:::

:::question{title="9. Pushed out of the field" exam="NEET level"}
Small samples of bismuth, aluminium, nickel and copper chloride are placed one at a time near the pole of a strong magnet, where the field is non-uniform. Which one moves towards the **weaker** field?

---

Only a diamagnetic substance moves from strong to weak field. Aluminium and copper chloride are paramagnetic (even though copper itself is diamagnetic) and nickel is ferromagnetic. The answer is **bismuth**.
:::

:::question{title="10. Warming a paramagnet" exam="NEET level"}
(Uses Curie's law, exam extra.) A paramagnetic salt has susceptibility $4\times10^{-4}$ at 200 K. Find its susceptibility at 300 K, in the same weak field.

---

$\chi \propto \dfrac{1}{T}$, so $\chi_2 = \chi_1 \dfrac{T_1}{T_2} = 4\times10^{-4} \times \dfrac{200}{300}$

$\approx$ **$2.7\times10^{-4}$**.
:::
