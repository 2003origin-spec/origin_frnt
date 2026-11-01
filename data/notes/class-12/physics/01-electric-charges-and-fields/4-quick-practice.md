---
title: "Electric Charges and Fields: Quick Practice"
type: practice
chapter: c12.physics.electric-charges-and-fields
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. Use $e = 1.6 \times 10^{-19}$ C and $\dfrac{1}{4\pi\varepsilon_0} = 9 \times 10^9$ N m² C⁻².

## Charge and Coulomb's law

:::question{title="1. Possible charge" exam="NEET level"}
Which of these can **not** be the charge on a body: $3.2 \times 10^{-19}$ C, $4.8 \times 10^{-19}$ C, $2.4 \times 10^{-19}$ C, $8.0 \times 10^{-19}$ C?

---

Divide each by $e = 1.6 \times 10^{-19}$ C: the results are 2, 3, 1.5 and 5. Charge must be a whole-number multiple of $e$, so **$2.4 \times 10^{-19}$ C** is not possible.
:::

:::question{title="2. Touch and separate" exam="NEET level"}
Identical small metal spheres with $+6$ µC and $-2$ µC attract with force $F$. They are touched and put back at the same distance. Find the new force.

---

Each gets $\dfrac{6 + (-2)}{2} = +2$ µC. Before, $F \propto 6 \times 2 = 12$; after, $F' \propto 2 \times 2 = 4$. So **F/3, now repulsive**.
:::

:::question{title="3. Zero net force" exam="JEE Main level"}
Charges $+q$ and $+4q$ are fixed 30 cm apart. Where should a third charge be placed so that the net electric force on it is zero?

---

For like charges, the point lies between them. Let it be $x$ from $+q$:
$$\frac{q}{x^2} = \frac{4q}{(0.3 - x)^2}$$
So $0.3 - x = 2x$, giving $x = 0.1$ m. **10 cm from $+q$** (20 cm from $+4q$), whatever the third charge is.
:::

## Electric field

:::question{title="4. Field at the midpoint" exam="NEET level"}
Charges $+2$ µC and $-2$ µC are 20 cm apart. Find the electric field at the midpoint.

---

Each charge is 0.1 m away. Each field is $\dfrac{9 \times 10^9 \times 2 \times 10^{-6}}{(0.1)^2} = 1.8 \times 10^6$ N/C. Both point towards the negative charge, so they add: **$3.6 \times 10^6$ N/C, towards the −2 µC charge**.
:::

:::question{title="5. Floating oil drop" exam="NEET level"}
An oil drop of mass $3.2 \times 10^{-15}$ kg with some extra electrons stays at rest in a uniform field of $1.0 \times 10^5$ N/C. How many extra electrons does it have, and which way does the field point?

---

The electric force balances the weight: $qE = mg$, so $q = \dfrac{3.2 \times 10^{-15} \times 10}{1.0 \times 10^5} = 3.2 \times 10^{-19}$ C. That is $n = \dfrac{3.2 \times 10^{-19}}{1.6 \times 10^{-19}} =$ **2 electrons**. The force must be upward, and the charge is negative, so the field points **downward**.
:::

:::question{title="6. Deflecting an electron" exam="JEE Main level"}
An electron moving horizontally at $2 \times 10^7$ m/s enters a uniform vertical electric field of $1.0 \times 10^4$ N/C. The field region is 5 cm long. How far is the electron deflected sideways by the time it leaves the field? Take $e/m = 1.76 \times 10^{11}$ C/kg and ignore gravity.

---

Acceleration $a = \dfrac{e}{m}E = 1.76 \times 10^{15}$ m/s². Time in the field $t = \dfrac{0.05}{2 \times 10^7} = 2.5 \times 10^{-9}$ s.

$y = \tfrac12 a t^2 = \tfrac12 \times 1.76 \times 10^{15} \times 6.25 \times 10^{-18} \approx 5.5 \times 10^{-3}$ m, that is **about 5.5 mm** (opposite to the field).
:::

## Dipole

:::question{title="7. Axial and equatorial" exam="NEET level"}
The field of a short dipole at a point on its axis, 10 cm from its centre, is $E$. What is the field at a point on its equatorial line, 20 cm from its centre?

---

Axial: $E = \dfrac{2kp}{(10)^3}$. Equatorial: $E' = \dfrac{kp}{(20)^3}$ (distances in cm, $k = 1/4\pi\varepsilon_0$).

$\dfrac{E'}{E} = \dfrac{1}{2} \times \dfrac{10^3}{20^3} = \dfrac{1}{16}$. So $E' =$ **E/16**, pointing opposite to $\vec p$.
:::

:::question{title="8. Torque on a dipole" exam="NEET level"}
A dipole is made of charges $\pm 2$ nC placed 3 mm apart. It sits at $30^\circ$ to a uniform field of $5 \times 10^4$ N/C. Find the torque on it and the net force on it.

---

$p = q \times 2a = 2 \times 10^{-9} \times 3 \times 10^{-3} = 6 \times 10^{-12}$ C m.

$\tau = pE\sin 30^\circ = 6 \times 10^{-12} \times 5 \times 10^4 \times 0.5 =$ **$1.5 \times 10^{-7}$ N m**. The field is uniform, so the net force is **zero**.
:::

## Gauss's law

:::question{title="9. Flux through a cube face" exam="NEET level"}
A charge of 8.85 µC is at the centre of a cube of side 10 cm. Find the flux through one face. Take $\varepsilon_0 = 8.85 \times 10^{-12}$ C² N⁻¹ m⁻².

---

Total flux $= \dfrac{q}{\varepsilon_0} = \dfrac{8.85 \times 10^{-6}}{8.85 \times 10^{-12}} = 1.0 \times 10^6$ N m²/C. By symmetry each of the 6 faces gets an equal share: **about $1.7 \times 10^5$ N m²/C**. The side of the cube does not matter.
:::

:::question{title="10. Two concentric shells" exam="JEE Main level"}
A thin shell of radius $R$ has charge $+Q$. A concentric thin shell of radius $2R$ has $-2Q$. Find the field at distances $0.5R$, $1.5R$ and $3R$ from the centre. Write $k = 1/4\pi\varepsilon_0$.

---

Take a spherical Gaussian surface of radius $r$:

- $r = 0.5R$: no charge inside, so **$E = 0$**.
- $r = 1.5R$: inside is $+Q$, so $E = \dfrac{kQ}{(1.5R)^2} =$ **$\dfrac{4kQ}{9R^2}$, outward**.
- $r = 3R$: inside is $Q - 2Q = -Q$, so $E =$ **$\dfrac{kQ}{9R^2}$, inward**.
:::
