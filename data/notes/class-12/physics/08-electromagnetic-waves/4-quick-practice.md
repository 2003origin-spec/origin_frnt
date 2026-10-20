---
title: "Electromagnetic Waves: Quick Practice"
type: practice
chapter: c12.physics.electromagnetic-waves
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. In this chapter also take $c = 3 \times 10^8$ m/s and $\mu_0 = 4\pi \times 10^{-7}$ T m A⁻¹.

## Displacement current

:::question{title="1. Capacitor gap" exam="NEET level"}
The potential difference across a 2 μF capacitor is rising at $5 \times 10^5$ V/s. What is the displacement current between its plates?

---

$i_d = C\,\dfrac{dV}{dt} = 2 \times 10^{-6} \times 5 \times 10^5 =$ **1 A**. It equals the conduction current in the connecting wires.
:::

:::question{title="2. Field between the plates" exam="JEE Main level"}
A capacitor with circular plates of radius 5 cm is charged by a constant current of 0.2 A. Find the magnetic field in the gap (a) 2 cm from the axis, (b) 10 cm from the axis. Ignore edge effects.

---

$i_d = 0.2$ A, spread evenly over the plates. $\dfrac{\mu_0}{2\pi} = 2 \times 10^{-7}$.

(a) Inside ($r < R$): $B = \dfrac{\mu_0 i_d r}{2\pi R^2} = \dfrac{2 \times 10^{-7} \times 0.2 \times 0.02}{(0.05)^2} =$ **3.2 × 10⁻⁷ T**.

(b) Outside ($r > R$): $B = \dfrac{\mu_0 i_d}{2\pi r} = \dfrac{2 \times 10^{-7} \times 0.2}{0.1} =$ **4 × 10⁻⁷ T**.
:::

## Sources and nature of EM waves

:::question{title="3. Which one radiates?" exam="NEET level"}
Which of these produces electromagnetic waves?

(a) A charge at rest (b) A charge moving in a straight line at constant velocity (c) A steady current in a straight wire (d) A charge moving in a circle at constant speed

---

Only accelerated charges radiate. In (d) the direction of velocity keeps changing, so the charge is accelerated. Answer: **(d)**.
:::

:::question{title="4. Magnetic amplitude" exam="NEET level"}
The electric field amplitude of an EM wave in vacuum is 9 V/m. Find the magnetic field amplitude.

---

$B_0 = \dfrac{E_0}{c} = \dfrac{9}{3 \times 10^8} = 3 \times 10^{-8}$ T $=$ **30 nT**.
:::

:::question{title="5. Direction of B" exam="NEET level"}
An EM wave travels along $+z$. At some instant its electric field at a point is along $+y$. Along which direction is its magnetic field there?

---

$\vec B$ is along $\hat k \times \vec E$, with $\hat k$ the direction of travel: $\hat k \times \hat j = -\hat i$. Check: $\hat j \times (-\hat i) = +\hat k$, the direction of travel. Answer: **along $-x$**.
:::

:::question{title="6. Reading the wave equation" exam="JEE Main level"}
The magnetic field of an EM wave in vacuum is
$$\begin{aligned} \vec B = {} & (3 \times 10^{-8}\ \text{T})\,\hat j \\ & \times \sin(1.6 \times 10^3 x + 4.8 \times 10^{11} t) \end{aligned}$$
Find (a) its wavelength, (b) its direction of travel, (c) its electric field.

---

(a) $k = 1.6 \times 10^3$ rad/m, so $\lambda = \dfrac{2\pi}{1.6 \times 10^3} \approx$ **3.9 mm** (a microwave). Check: $\omega/k = 3 \times 10^8$ m/s.

(b) The $+\omega t$ sign means it travels along **$-x$**.

(c) $E_0 = cB_0 = 9$ V/m. $\vec E$ must make $\vec E \times \vec B$ point along $-x$: $\hat k \times \hat j = -\hat i$, so $\vec E$ is along $+z$:

$$\begin{aligned} \vec E = {} & (9\ \text{V/m})\,\hat k \\ & \times \sin(1.6 \times 10^3 x + 4.8 \times 10^{11} t) \end{aligned}$$

So **$E_0 = 9$ V/m, along $+z$**.
:::

:::question{title="7. Wave in a medium" exam="JEE Main level"}
A 100 MHz radio wave enters a non-magnetic medium ($\mu_r = 1$) of relative permittivity $\varepsilon_r = 4$. Find its speed, frequency and wavelength in the medium.

---

$v = \dfrac{1}{\sqrt{\mu\varepsilon}} = \dfrac{c}{\sqrt{\mu_r\varepsilon_r}} = \dfrac{3 \times 10^8}{2} = 1.5 \times 10^8$ m/s.

The frequency is set by the source: still 100 MHz. $\lambda = \dfrac{v}{\nu} = \dfrac{1.5 \times 10^8}{10^8} = 1.5$ m (it was 3 m in vacuum).

Answer: **$1.5 \times 10^8$ m/s, 100 MHz, 1.5 m**.
:::

## Spectrum

:::question{title="8. Match the use" exam="NEET level"}
Match each use with the wave: (A) speed guns for fast balls, (B) TV remote control, (C) tanning of the skin, (D) checking a bone fracture.

Waves: X-rays, infrared, microwaves, ultraviolet.

---

**A: microwaves, B: infrared, C: ultraviolet, D: X-rays.**
:::

## Energy and pressure (exam extra)

:::question{title="9. Field near a lamp" exam="JEE Main level"}
A lamp radiates 100 W of EM radiation equally in all directions. Find the amplitude of the electric field 2 m away. Take $\varepsilon_0 = 8.85 \times 10^{-12}$ C² N⁻¹ m⁻².

---

$I = \dfrac{P}{4\pi r^2} = \dfrac{100}{4\pi \times 4} \approx 1.99$ W/m².

$I = \tfrac12\varepsilon_0 c E_0^2$, so $E_0 = \sqrt{\dfrac{2I}{\varepsilon_0 c}} = \sqrt{\dfrac{3.98}{2.655 \times 10^{-3}}} \approx \sqrt{1499} \approx$ **39 V/m**.
:::

:::question{title="10. Push of light" exam="JEE Main level"}
Light of intensity 30 W/m² falls normally on a flat surface of area 2 m². Find the force on it if the surface (a) absorbs all the light, (b) reflects all of it.

---

(a) $F = \dfrac{IA}{c} = \dfrac{30 \times 2}{3 \times 10^8} =$ **2 × 10⁻⁷ N**.

(b) A reflector gets twice the momentum: $F = \dfrac{2IA}{c} =$ **4 × 10⁻⁷ N**.
:::
