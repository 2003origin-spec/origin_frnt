---
title: "Wave Optics: Quick Practice"
type: practice
chapter: c12.physics.wave-optics
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise (no question here needs it). Take $c = 3.0 \times 10^8$ m/s.

## Refraction and Brewster's law

:::question{title="1. Light entering glass" exam="NEET level"}
Light of wavelength 600 nm in air enters glass of refractive index 1.5. Find its frequency, speed and wavelength in the glass.

---

Frequency does not change: $\nu = \dfrac{c}{\lambda} = \dfrac{3 \times 10^8}{600 \times 10^{-9}} =$ **5 × 10¹⁴ Hz**.

Speed $v = \dfrac{c}{n} = \dfrac{3 \times 10^8}{1.5} =$ **2 × 10⁸ m/s**. Wavelength $= \dfrac{600}{1.5} =$ **400 nm**.
:::

:::question{title="2. Brewster angle (exam extra)" exam="NEET level"}
Unpolarised light falls from air on a glass surface of refractive index $\sqrt3$. At what angle of incidence is the reflected light completely polarised, and what is the angle of refraction then?

---

$\tan i_B = n = \sqrt3$, so $i_B =$ **60°**. At this angle the reflected and refracted rays are perpendicular, so $r = 90^\circ - 60^\circ =$ **30°**. Check: $\sin 60^\circ / \sin 30^\circ = \sqrt3$.
:::

## Interference

:::question{title="3. Third dark fringe" exam="NEET level"}
In a YDSE, $d = 0.5$ mm, $D = 1$ m and $\lambda = 500$ nm. Find the fringe width and the distance of the third dark fringe from the central bright fringe.

---

$\beta = \dfrac{\lambda D}{d} = \dfrac{500 \times 10^{-9} \times 1}{0.5 \times 10^{-3}} = 10^{-3}$ m $=$ **1 mm**.

Dark fringes are at $0.5\beta, 1.5\beta, 2.5\beta, \dots$ The third is at $2.5\beta =$ **2.5 mm**.
:::

:::question{title="4. Intensity at λ/4" exam="NEET level"}
In a YDSE with two identical slits, the intensity at the central maximum is $I$. What is the intensity at a point where the path difference is $\lambda/4$?

---

$\phi = \dfrac{2\pi}{\lambda} \times \dfrac{\lambda}{4} = \dfrac{\pi}{2}$. Then $I' = I\cos^2\dfrac{\phi}{2} = I\cos^2 45^\circ =$ **I/2**.
:::

:::question{title="5. Unequal slits (exam extra)" exam="JEE Main level"}
The two slits in a YDSE give intensities in the ratio 9 : 1 on the screen. Find the ratio of the maximum to the minimum intensity in the pattern.

---

$\sqrt{I_1} : \sqrt{I_2} = 3 : 1$. So $\dfrac{I_{max}}{I_{min}} = \left(\dfrac{3 + 1}{3 - 1}\right)^2 = \left(\dfrac{4}{2}\right)^2 =$ **4 : 1**.
:::

:::question{title="6. Two colours" exam="JEE Main level"}
Light of wavelengths 600 nm and 400 nm is used together in a YDSE with $d = 1$ mm and $D = 1$ m. What is the least distance from the central maximum at which bright fringes of both colours fall on each other?

---

Need $n_1 \times 600 = n_2 \times 400$ with the smallest whole numbers: $n_1 = 2$, $n_2 = 3$ (both give 1200 nm).

$x = \dfrac{2 \times 600 \times 10^{-9} \times 1}{1 \times 10^{-3}} = 1.2 \times 10^{-3}$ m $=$ **1.2 mm**.
:::

:::question{title="7. YDSE under water" exam="NEET level"}
The fringe width in a YDSE in air is 1.2 mm. The whole apparatus is put in water of refractive index 4/3. What is the new fringe width?

---

The wavelength becomes $\lambda/n$, so $\beta' = \dfrac{\beta}{n} = \dfrac{1.2}{4/3} =$ **0.9 mm**.
:::

## Diffraction

:::question{title="8. Central maximum" exam="NEET level"}
Light of wavelength 600 nm falls normally on a slit 0.2 mm wide. The screen is 2 m away. Find the width of the central maximum.

---

Width $= \dfrac{2\lambda D}{a} = \dfrac{2 \times 600 \times 10^{-9} \times 2}{0.2 \times 10^{-3}} = 1.2 \times 10^{-2}$ m $=$ **12 mm**.
:::

:::question{title="9. Minimum on a maximum" exam="JEE Main level"}
In a single-slit pattern, the first minimum for light of wavelength 600 nm falls at the same angle as the first secondary maximum for another wavelength $\lambda'$. Using NCERT's approximate positions, find $\lambda'$.

---

First minimum: $\theta \approx \dfrac{\lambda}{a}$. First secondary maximum: $\theta \approx \left(1 + \tfrac12\right)\dfrac{\lambda'}{a} = \dfrac{3\lambda'}{2a}$.

Equate: $600 = \tfrac32\lambda'$, so $\lambda' =$ **400 nm**.
:::

## Polarisation

:::question{title="10. Two polaroids" exam="NEET level"}
Unpolarised light of intensity $I_0$ passes through two polaroids whose pass axes are at $60^\circ$ to each other. What intensity comes out?

---

After the first polaroid: $\dfrac{I_0}{2}$. After the second (Malus' law): $\dfrac{I_0}{2}\cos^2 60^\circ = \dfrac{I_0}{2} \times \dfrac14 =$ **I₀/8**.
:::
