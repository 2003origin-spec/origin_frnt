---
title: "Ray Optics: Quick Practice"
type: practice
chapter: c12.physics.ray-optics-and-optical-instruments
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. All answers use NCERT's Cartesian sign convention, with light going left to right.

## Mirrors

:::question{title="1. Concave mirror" exam="NEET level"}
An object is placed 20 cm in front of a concave mirror of focal length 15 cm. Find the position, nature and magnification of the image.

---

$u = -20$ cm, $f = -15$ cm. $\dfrac1v = \dfrac1f - \dfrac1u = -\dfrac1{15} + \dfrac1{20} = -\dfrac1{60}$, so $v = -60$ cm.

$m = -\dfrac{v}{u} = -\dfrac{-60}{-20} = -3$. The image is **60 cm in front of the mirror, real, inverted, 3 times bigger**.
:::

:::question{title="2. Convex mirror" exam="NEET level"}
An object is 20 cm in front of a convex mirror of radius of curvature 40 cm. Where is the image and what is its magnification?

---

$f = +20$ cm, $u = -20$ cm. $\dfrac1v = \dfrac1{20} + \dfrac1{20} = \dfrac1{10}$, so $v = +10$ cm.

$m = -\dfrac{10}{-20} = +\dfrac12$. The image is **10 cm behind the mirror, virtual, erect, half the size**.
:::

## Refraction and TIR

:::question{title="3. Pool depth" exam="NEET level"}
A coin lies at the bottom of a pool 1.2 m deep, seen from straight above. Take $n_{water} = 4/3$. How deep does the coin appear, and by how much does it seem raised?

---

Apparent depth $= \dfrac{1.2}{4/3} = 0.9$ m. It seems raised by $1.2 - 0.9 =$ **0.3 m**; it appears **0.9 m** deep.
:::

:::question{title="4. Critical angle" exam="NEET level"}
The critical angle of a medium with respect to air is $30^\circ$. Find its refractive index and the speed of light in it. (Take $c = 3 \times 10^8$ m/s.)

---

$n = \dfrac{1}{\sin 30^\circ} =$ **2**. Speed $= \dfrac{c}{n} =$ **1.5 × 10⁸ m/s**.
:::

:::question{title="5. Circle of light" exam="JEE Main level"}
A small bulb sits 0.6 m below the surface of a liquid of refractive index $5/4$. Find the radius of the circle on the surface through which light leaves the liquid.

---

$\sin i_c = \dfrac45$, so $\cos i_c = \dfrac35$ and $\tan i_c = \dfrac43$. Rays hitting the surface farther out meet it at more than $i_c$ and are totally reflected.

Radius $= h\tan i_c = 0.6 \times \dfrac43 =$ **0.8 m** (area $= 0.64\pi \approx 2.0$ m²).
:::

## Lenses

:::question{title="6. Lens in water" exam="JEE Main level"}
An equiconvex glass lens ($n = 1.5$) has both radii 20 cm. Find its focal length in air and in water ($n = 4/3$).

---

Air: $\dfrac1f = (1.5 - 1)\left(\dfrac1{20} + \dfrac1{20}\right) = \dfrac1{20}$, so $f =$ **20 cm**.

Water: $n_{21} = \dfrac{1.5}{4/3} = \dfrac98$. $\dfrac1f = \left(\dfrac98 - 1\right)\dfrac{2}{20} = \dfrac1{80}$, so $f =$ **80 cm** (still converging, 4 times longer).
:::

:::question{title="7. Two lenses in contact" exam="NEET level"}
A convex lens of focal length 20 cm touches a concave lens of focal length 40 cm. An object is 60 cm from the pair. Find the power of the pair and the image position.

---

$P = \dfrac{1}{0.20} - \dfrac{1}{0.40} = 5 - 2.5 = +2.5$ D, so $f = +40$ cm (converging).

$u = -60$ cm: $\dfrac1v = \dfrac1{40} - \dfrac1{60} = \dfrac1{120}$, so $v =$ **+120 cm** (real, on the far side), $m = \dfrac{120}{-60} = -2$: inverted, twice the size. **P = +2.5 D**.
:::

## Prism and instruments

:::question{title="8. Minimum deviation" exam="NEET level"}
A prism of angle $60^\circ$ gives a minimum deviation of $30^\circ$. Find its refractive index and the angle of incidence at minimum deviation.

---

$n = \dfrac{\sin[(60^\circ + 30^\circ)/2]}{\sin 30^\circ} = \dfrac{\sin 45^\circ}{\sin 30^\circ} = \dfrac{1/\sqrt2}{1/2} =$ **√2 ≈ 1.41**.

$i = \dfrac{A + D_m}{2} =$ **45°**.
:::

:::question{title="9. Compound microscope" exam="NEET level"}
A compound microscope has $f_o = 1$ cm, $f_e = 5$ cm and tube length $L = 15$ cm. Using NCERT's approximate formulas, find its magnifying power with the final image (a) at infinity, (b) at the near point (25 cm).

---

$m_o = \dfrac{L}{f_o} = 15$.

(a) $m_e = \dfrac{25}{5} = 5$, so $m =$ **75**.

(b) $m_e = 1 + \dfrac{25}{5} = 6$, so $m =$ **90**.
:::

:::question{title="10. Telescope" exam="JEE Main level"}
An astronomical telescope has an objective of focal length 150 cm and an eyepiece of 5 cm.

(a) Find its magnifying power and tube length in normal adjustment.

(b) Find the magnifying power when the final image is at the near point, $D = 25$ cm.

---

(a) $m = \dfrac{150}{5} =$ **30**; tube length $= 150 + 5 =$ **155 cm**.

(b) $m = \dfrac{f_o}{f_e}\left(1 + \dfrac{f_e}{D}\right) = 30 \times \left(1 + \dfrac{5}{25}\right) =$ **36**. (NCERT Exercise 9.27(b) asks for this case; the formula is not derived in the text.)
:::
