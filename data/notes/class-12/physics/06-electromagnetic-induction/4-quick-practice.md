---
title: "Electromagnetic Induction: Quick Practice"
type: practice
chapter: c12.physics.electromagnetic-induction
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise.

## Flux and Faraday's law

:::question{title="1. Tilted loop" exam="NEET level"}
A flat loop of area 0.02 m² is in a uniform field of 0.5 T. The normal to the loop makes $60^\circ$ with the field. Find the flux. If the field then falls steadily to zero in 0.1 s, find the average induced emf.

---

$\Phi = BA\cos 60^\circ = 0.5 \times 0.02 \times 0.5 =$ **$5 \times 10^{-3}$ Wb**.

$|\varepsilon| = \dfrac{\Delta\Phi}{\Delta t} = \dfrac{5 \times 10^{-3}}{0.1} =$ **0.05 V** (50 mV).
:::

:::question{title="2. Flux as a function of time" exam="NEET level"}
The flux through each turn of a 50-turn coil is $\Phi = (5t^2 + 3t + 2)$ mWb, with $t$ in seconds. Find the size of the induced emf at $t = 2$ s.

---

$\dfrac{d\Phi}{dt} = 10t + 3 = 23$ mWb/s at $t = 2$ s.

$|\varepsilon| = N\dfrac{d\Phi}{dt} = 50 \times 23 \times 10^{-3} =$ **1.15 V**.
:::

:::question{title="3. Coil flipped over" exam="JEE Main level"}
A coil of 200 turns and area 0.01 m² has resistance 4 Ω. Its plane is perpendicular to a uniform 0.2 T field. It is turned through $180^\circ$ in 0.1 s. Find the average emf and the total charge that flows.

---

Flux per turn goes from $+BA = 2 \times 10^{-3}$ Wb to $-2 \times 10^{-3}$ Wb, so the change in flux linkage is $200 \times 4 \times 10^{-3} = 0.8$ Wb.

Average emf $= \dfrac{0.8}{0.1} =$ **8 V**. Average current $= 8/4 = 2$ A, so charge $= 2 \times 0.1 =$ **0.2 C** (the same as $N\Delta\Phi/R$).
:::

## Lenz's law and motional emf

:::question{title="4. Magnet through a ring" exam="NEET level"}
A bar magnet is dropped, N-pole down, towards a horizontal closed copper ring below it. As seen from above, what is the direction of the induced current while the magnet approaches the ring? Is the magnet's acceleration more than, equal to, or less than $g$?

---

The downward flux through the ring increases. The induced current must make an **upward** field, which means an **anticlockwise** current seen from above. The ring repels the magnet, so its acceleration is **less than $g$**.
:::

:::question{title="5. Rod on rails" exam="JEE Main level"}
A rod lies across smooth parallel rails 2 m apart and slides along them at a constant 5 m/s. A uniform 0.2 T field is perpendicular to the plane of the rails. The rails are joined by a 4 Ω resistor; everything else has negligible resistance. Find the current and the force needed to keep the rod moving.

---

$\varepsilon = Blv = 0.2 \times 2 \times 5 = 2$ V, so $I = 2/4 =$ **0.5 A**.

Force $= BIl = 0.2 \times 0.5 \times 2 =$ **0.2 N**. Check: power $Fv = 1$ W $= I^2R = 0.25 \times 4$ W.
:::

:::question{title="6. Spinning rod" exam="NEET level"}
A metal rod 0.5 m long rotates at 20 rad/s about one end, in a plane perpendicular to a uniform 0.4 T field. Find the emf between its ends.

---

$\varepsilon = \tfrac12 B\omega R^2 = \tfrac12 \times 0.4 \times 20 \times 0.25 =$ **1 V**.
:::

## Inductance

:::question{title="7. Finding L" exam="NEET level"}
The current in a coil rises steadily from 2 A to 6 A in 0.05 s, and the induced emf is 40 V. Find the self-inductance, and the energy stored when the current is 6 A.

---

$L = \dfrac{\varepsilon}{dI/dt} = \dfrac{40}{4/0.05} = \dfrac{40}{80} =$ **0.5 H**.

$U = \tfrac12 LI^2 = \tfrac12 \times 0.5 \times 36 =$ **9 J**.
:::

:::question{title="8. Rewinding a solenoid" exam="JEE Main level"}
A long solenoid is made from a fixed length of wire. The same wire is rewound into a solenoid of the **same length** but **half the radius**. What happens to its self-inductance?

---

Each turn now uses half as much wire, so $N$ doubles. The area $\pi r^2$ becomes $\tfrac14$. Since $L = \mu_0N^2A/l$, $L$ changes by $4 \times \tfrac14 = 1$: it stays **unchanged**.
:::

:::question{title="9. Mutual inductance" exam="NEET level"}
Two coils have mutual inductance 0.2 H. The current in the first rises steadily from 0 to 10 A in 0.02 s. Find the emf induced in the second coil and the change in its flux linkage.

---

$|\varepsilon_2| = M\dfrac{dI_1}{dt} = 0.2 \times \dfrac{10}{0.02} =$ **100 V**.

Change in flux linkage $= M\,\Delta I_1 = 0.2 \times 10 =$ **2 Wb**.
:::

## AC generator

:::question{title="10. Generator peak emf" exam="NEET level"}
A generator coil of 50 turns and area 0.02 m² turns at 600 rpm in a uniform 0.5 T field, about an axis perpendicular to the field. Find the peak emf. At what position of the coil does it occur?

---

$\nu = 600/60 = 10$ rev/s, so $\omega = 20\pi$ rad/s.

$\varepsilon_0 = NBA\omega = 50 \times 0.5 \times 0.02 \times 20\pi = 10\pi \approx$ **31.4 V**. It occurs when the **plane of the coil is parallel to the field** (flux zero, changing fastest).
:::
