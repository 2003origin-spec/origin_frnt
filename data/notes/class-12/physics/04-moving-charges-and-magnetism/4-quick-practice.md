---
title: "Moving Charges and Magnetism: Quick Practice"
type: practice
chapter: c12.physics.moving-charges-and-magnetism
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. Use $\mu_0/4\pi = 10^{-7}$ T m/A and $e = 1.6 \times 10^{-19}$ C.

## Force on moving charges

:::question{title="1. Force on an electron" exam="NEET level"}
An electron moves along $+x$ at $2 \times 10^6$ m/s in a uniform field of 0.1 T along $+z$. Find the size and direction of the magnetic force on it.

---

$F = evB = 1.6 \times 10^{-19} \times 2 \times 10^6 \times 0.1 = 3.2 \times 10^{-14}$ N.

Direction: $\hat i \times \hat k = -\hat j$, and the electron's charge is negative, so the force is along $+\hat j$. Answer: **$3.2 \times 10^{-14}$ N along $+y$**.
:::

:::question{title="2. Proton and alpha particle" exam="NEET level"}
A proton and an alpha particle have the same kinetic energy and move perpendicular to the same uniform magnetic field. Find the ratio of the radii of their paths, $r_p : r_\alpha$.

---

$r = \dfrac{\sqrt{2mK}}{qB}$. The alpha particle has 4 times the mass and 2 times the charge, so $r_\alpha = \dfrac{\sqrt{4}}{2}\,r_p = r_p$. Answer: **1 : 1**.
:::

:::question{title="3. Helical path" exam="JEE Main level"}
A particle with $q/m = 10^8$ C/kg enters a uniform field $B = 0.2$ T at $4 \times 10^5$ m/s, at $60^\circ$ to the field. Find the radius and the pitch of its helical path.

---

$\dfrac{qB}{m} = 10^8 \times 0.2 = 2 \times 10^7$ rad/s.

$v_\perp = 4 \times 10^5 \sin 60^\circ = 2\sqrt3 \times 10^5$ m/s, so $r = \dfrac{v_\perp}{qB/m} = \sqrt3 \times 10^{-2}$ m $\approx$ **1.73 cm**.

$T = \dfrac{2\pi}{2 \times 10^7} = \pi \times 10^{-7}$ s and $v_\parallel = 4 \times 10^5 \cos 60^\circ = 2 \times 10^5$ m/s, so $p = v_\parallel T = 2\pi \times 10^{-2}$ m $\approx$ **6.28 cm**.
:::

## Fields of currents

:::question{title="4. Loop: axis and centre" exam="NEET level"}
The magnetic field at the centre of a circular loop of radius $R$ is $B_0$. Find the field on its axis at a distance $\sqrt3\,R$ from the centre.

---

$\dfrac{B}{B_0} = \dfrac{R^3}{(x^2 + R^2)^{3/2}} = \dfrac{R^3}{(4R^2)^{3/2}} = \dfrac{R^3}{8R^3}$, so $B =$ **$B_0/8$**.
:::

:::question{title="5. Field near a wire" exam="NEET level"}
A long vertical wire carries 10 A upwards. Find the magnetic field due to the wire at a point 5 cm due east of it, and its direction. Ignore the earth's field.

---

$B = \dfrac{\mu_0 I}{2\pi r} = \dfrac{2 \times 10^{-7} \times 10}{0.05} =$ **$4 \times 10^{-5}$ T**.

Thumb up, the fingers curl anticlockwise when seen from above. At a point east of the wire, that direction is **towards the north**.
:::

:::question{title="6. Inside and outside a thick wire" exam="JEE Main level"}
A long straight wire of radius 2 mm carries 4 A, spread uniformly over its cross-section. Find the field at 1 mm and at 4 mm from its axis.

---

Inside ($r = 1$ mm): $B = \dfrac{\mu_0 I r}{2\pi a^2} = \dfrac{2 \times 10^{-7} \times 4 \times 10^{-3}}{(2 \times 10^{-3})^2} = 2 \times 10^{-4}$ T.

Outside ($r = 4$ mm): $B = \dfrac{\mu_0 I}{2\pi r} = \dfrac{2 \times 10^{-7} \times 4}{4 \times 10^{-3}} = 2 \times 10^{-4}$ T.

Both are **$2 \times 10^{-4}$ T**: half the surface value at both points.
:::

:::question{title="7. Solenoid" exam="NEET level"}
A solenoid 40 cm long has 800 turns and carries 2.5 A. Its length is much larger than its radius. Find the field inside it, near the middle.

---

$n = \dfrac{800}{0.4} = 2000$ per metre. $B = \mu_0 nI = 4\pi \times 10^{-7} \times 2000 \times 2.5 = 2\pi \times 10^{-3}$ T $\approx$ **$6.3 \times 10^{-3}$ T**.
:::

## Forces and torques on currents

:::question{title="8. Two parallel wires" exam="NEET level"}
Two long parallel wires 10 cm apart carry 5 A and 8 A in **opposite** directions. Find the force per metre on each wire, and say whether it attracts or repels.

---

$f = \dfrac{\mu_0 I_a I_b}{2\pi d} = \dfrac{2 \times 10^{-7} \times 5 \times 8}{0.1} = 8 \times 10^{-5}$ N/m. Opposite currents repel. Answer: **$8 \times 10^{-5}$ N/m, repulsive**.
:::

:::question{title="9. Torque and work on a coil" exam="JEE Main level"}
A coil of 50 turns, each of area $4 \times 10^{-3}$ m², carries 2 A in a uniform field of 0.5 T.

(a) Find the torque when the normal to the coil is at $30^\circ$ to the field.

(b) How much work is needed to turn the coil from its stable position to its unstable position?

---

$m = NIA = 50 \times 2 \times 4 \times 10^{-3} = 0.4$ A m².

(a) $\tau = mB\sin 30^\circ = 0.4 \times 0.5 \times 0.5 =$ **0.1 N m**.

(b) $W = mB(\cos 0^\circ - \cos 180^\circ) = 2mB = 2 \times 0.4 \times 0.5 =$ **0.4 J**.
:::

## Galvanometer

:::question{title="10. Ammeter and voltmeter" exam="JEE Main level"}
A galvanometer of resistance 50 Ω gives full-scale deflection at 2 mA.

(a) What shunt turns it into an ammeter reading up to 1 A?

(b) What series resistance turns it into a voltmeter reading up to 10 V?

---

(a) The shunt carries $1 - 0.002 = 0.998$ A at the same p.d. as the coil: $r_s = \dfrac{0.002 \times 50}{0.998} \approx$ **0.1 Ω**, in parallel.

(b) Total resistance $= \dfrac{10}{0.002} = 5000$ Ω, so $R = 5000 - 50 =$ **4950 Ω**, in series.
:::
