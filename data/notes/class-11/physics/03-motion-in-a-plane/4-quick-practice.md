---
title: "Motion in a Plane: Quick Practice"
type: practice
chapter: c11.physics.motion-in-a-plane
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise.

## Vectors

:::question{title="1. Possible resultants" exam="NEET level"}
Two forces of 3 N and 5 N act on a body. Which of these can **not** be their resultant: 2 N, 5 N, 8 N, 9 N?

---

The resultant can be anything from $5 - 3 = 2$ N (forces opposite) to $5 + 3 = 8$ N (same direction), both ends included. **9 N** is outside this range, so it is not possible. 2 N, 5 N and 8 N are all possible.
:::

:::question{title="2. Two equal forces" exam="NEET level"}
Two forces, each of size $F$, act at $120^\circ$ to each other. Find the resultant.

---

$R = 2F\cos\left(\dfrac{120^\circ}{2}\right) = 2F\cos 60^\circ$, which is just **F**, along the bisector, at **60°** to each force.
:::

:::question{title="3. Sum equals difference" exam="JEE Main level"}
If $|\vec A + \vec B| = |\vec A - \vec B|$ for two non-zero vectors, what is the angle between $\vec A$ and $\vec B$?

---

Square both sides: $A^2 + B^2 + 2AB\cos\theta = A^2 + B^2 - 2AB\cos\theta$, so $\cos\theta = 0$ and $\theta =$ **90°**.
:::

## Projectiles

:::question{title="4. Range" exam="NEET level"}
A ball is thrown from level ground at 20 m/s at $30^\circ$ to the horizontal. Find its range.

---

$R = \dfrac{u^2\sin 2\theta}{g} = \dfrac{400 \times \sin 60^\circ}{10} = 20\sqrt3 \approx$ **34.6 m**.
:::

:::question{title="5. Maximum height" exam="NEET level"}
A ball is thrown at 20 m/s at $60^\circ$ to the horizontal. How high does it go?

---

$H = \dfrac{u^2\sin^2\theta}{2g} = \dfrac{400 \times \tfrac34}{20} =$ **15 m**.
:::

:::question{title="6. Range equals height" exam="JEE Main level"}
At what angle must a ball be thrown from level ground so that its range equals its maximum height?

---

$\dfrac{H}{R} = \dfrac{\tan\theta}{4} = 1$, so $\tan\theta = 4$ and $\theta = \tan^{-1}4 \approx$ **76°**.
:::

:::question{title="7. Thrown from a cliff" exam="NEET level"}
A stone is thrown horizontally at 10 m/s from the top of an 80 m high cliff. When and how far from the foot of the cliff does it land?

---

$t = \sqrt{\dfrac{2h}{g}} = \sqrt{\dfrac{2 \times 80}{10}} =$ **4 s**, and $x = ut = 10 \times 4 =$ **40 m**.
:::

:::question{title="8. Slowest point" exam="NEET level"}
A ball is thrown at 20 m/s at $60^\circ$ to the horizontal. What is its smallest speed during the flight?

---

The speed is smallest at the top, where only the horizontal part is left: $u\cos 60^\circ = 20 \times \tfrac12 =$ **10 m/s**.
:::

## Circular motion and rivers

:::question{title="9. Spinning wheel" exam="NEET level"}
A point on the rim of a wheel of radius 0.5 m goes round 2 times every second. Find its angular speed and its centripetal acceleration.

---

$\omega = 2\pi\nu = 2\pi \times 2 =$ **4π rad/s** (about 12.6 rad/s).

$a_c = \omega^2 r = 16\pi^2 \times 0.5 = 8\pi^2 \approx$ **79 m/s²** (about 80 m/s² if you take $\pi^2 \approx 10$).
:::

:::question{title="10. Crossing a river" exam="JEE Main level"}
A river is 100 m wide and flows at 3 m/s. A swimmer can swim at 5 m/s in still water.

(a) What is the shortest time to cross, and how far downstream does the swimmer land?

(b) If the swimmer wants to land directly opposite, how long does it take?

---

(a) Point straight across (perpendicular to the bank): $t = \dfrac{100}{5} =$ **20 s**. Drift $= 3 \times 20 =$ **60 m** downstream.

(b) Head upstream so that the flow is cancelled. The speed across the river is $\sqrt{5^2 - 3^2} = 4$ m/s, so $t = \dfrac{100}{4} =$ **25 s**. The heading is $\sin^{-1}\tfrac35 \approx 37^\circ$ upstream from straight across.
:::
