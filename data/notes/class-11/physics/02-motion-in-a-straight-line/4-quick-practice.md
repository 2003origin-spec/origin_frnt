---
title: "Motion in a Straight Line: Quick Practice"
type: practice
chapter: c11.physics.motion-in-a-straight-line
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise.

## Velocity and speed

:::question{title="1. Speed or velocity" exam="NEET level"}
A runner goes 300 m east in 60 s, then 100 m west in 40 s. Find the average speed and the average velocity for the whole run.

---

Path length $= 300 + 100 = 400$ m, time $= 100$ s, so average speed $=$ **4 m/s**.

Displacement $= 300 - 100 = 200$ m east, so average velocity $=$ **2 m/s east**.
:::

:::question{title="2. Two halves of a trip" exam="NEET level"}
A car covers the first half of a distance at 40 km/h and the second half at 60 km/h. Find its average speed.

---

For equal distances, $v_{av} = \dfrac{2v_1v_2}{v_1 + v_2} = \dfrac{2 \times 40 \times 60}{100} =$ **48 km/h** (not 50 km/h).
:::

:::question{title="3. Position given by a formula" exam="JEE Main level"}
A particle moves along the $x$-axis as $x = 2t^3 - 6t^2 + 5$ ($x$ in m, $t$ in s). Find its velocity and acceleration at $t = 3$ s, and the time $t > 0$ when it is momentarily at rest.

---

$v = \dfrac{dx}{dt} = 6t^2 - 12t$. At $t = 3$ s: $v = 54 - 36 =$ **18 m/s**.

$a = \dfrac{dv}{dt} = 12t - 12$. At $t = 3$ s: $a =$ **24 m/s²**.

At rest: $6t(t - 2) = 0$, so $t =$ **2 s**.
:::

## Uniform acceleration

:::question{title="4. Stopping a car" exam="NEET level"}
A car moves at 72 km/h. The driver sees a danger and presses the brake after a reaction time of 0.5 s. The brakes then give a steady deceleration of 5 m/s². Find the total distance from seeing the danger to stopping.

---

$72$ km/h $= 20$ m/s. During the reaction time: $20 \times 0.5 = 10$ m.

Braking distance $= \dfrac{v_0^2}{2a} = \dfrac{400}{10} = 40$ m. Total $=$ **50 m**.
:::

:::question{title="5. Distance in one second" exam="NEET level"}
A body starts from rest with a constant acceleration of 4 m/s². How far does it go in the 5th second?

---

$x(5) = \tfrac12 \times 4 \times 25 = 50$ m and $x(4) = \tfrac12 \times 4 \times 16 = 32$ m.

Distance in the 5th second $= 50 - 32 =$ **18 m**. (Check: $\tfrac{a}{2}(2n - 1) = 2 \times 9 = 18$ m.)
:::

:::question{title="6. It turns back" exam="JEE Main level"}
A particle starts with velocity $+10$ m/s and has a constant acceleration of $-2$ m/s². Find its displacement and the distance it covers in the first 8 s.

---

Displacement: $x = 10 \times 8 - \tfrac12 \times 2 \times 64 = 80 - 64 =$ **16 m**.

It stops when $10 - 2t = 0$, at $t = 5$ s, after going $\dfrac{10^2}{2 \times 2} = 25$ m forward. In the next 3 s it comes back $\tfrac12 \times 2 \times 3^2 = 9$ m. Distance $= 25 + 9 =$ **34 m**.
:::

:::question{title="7. Reading a v–t graph" exam="NEET level"}
A car's velocity rises uniformly from 0 to 20 m/s in 4 s, stays at 20 m/s for 6 s, then falls uniformly to 0 in the next 5 s. Find the distance covered and the average velocity.

---

Area under the $v$–$t$ graph $= \tfrac12 \times 4 \times 20 + 6 \times 20 + \tfrac12 \times 5 \times 20$.

That is $40 + 120 + 50 =$ **210 m**. Average velocity $= \dfrac{210}{15} =$ **14 m/s**.
:::

## Free fall

:::question{title="8. The third second" exam="NEET level"}
A stone is dropped from rest from a tall tower. How far does it fall during the 3rd second?

---

By the law of odd numbers, the 1st, 2nd and 3rd seconds give 5 m, 15 m and 25 m. So it falls **25 m** in the 3rd second. (Check: $x(3) - x(2) = 45 - 20 = 25$ m.)
:::

:::question{title="9. Thrown up from a tower" exam="JEE Main level"}
A ball is thrown straight up at 15 m/s from the top of a 20 m high tower. When does it hit the ground, and with what speed?

---

Take upward positive, origin at the top of the tower. The ground is at $y = -20$ m, and $a = -10$ m/s².

$-20 = 15t - 5t^2$, so $t^2 - 3t - 4 = 0$, giving $(t - 4)(t + 1) = 0$. So $t =$ **4 s** (reject $t = -1$).

$v = 15 - 10 \times 4 = -25$ m/s, so it lands at **25 m/s**, moving down. (Check: $v^2 = 15^2 + 2 \times 10 \times 20 = 625$.)
:::

## Relative velocity (exam extra)

:::question{title="10. Overtaking a train" exam="JEE Main level"}
Train A (200 m long) runs at 54 km/h. Train B (300 m long) runs at 36 km/h on a parallel track. How long does A take to pass B completely if (a) they move in the same direction, (b) they move in opposite directions?

---

Speeds: 15 m/s and 10 m/s. A must cover the two lengths relative to B: $200 + 300 = 500$ m.

(a) Relative speed $= 15 - 10 = 5$ m/s, so $t = \dfrac{500}{5} =$ **100 s**.

(b) Relative speed $= 15 + 10 = 25$ m/s, so $t = \dfrac{500}{25} =$ **20 s**.
:::
