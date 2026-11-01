---
title: "Experimental Skills: Important Points and Traps"
type: key_points
chapter: c12.physics.experimental-skills
order: 3
---

No NCERT chapter — these notes follow the JEE Main and NEET experimental-skills lists (the same 18 experiments in both).

## Zero error and least count

:::trap
**Zero-error sign.** Correct reading = observed reading − zero error. A **positive** zero error is **subtracted**; a **negative** zero error is **added** (subtracting a negative number). Students often do the opposite.
:::

- **Vernier:** jaws closed, vernier zero to the **right** of the main-scale zero → positive error ($+\,n \times$ LC). To the **left** → negative error ($-(N - n) \times$ LC).
- **Screw gauge:** faces touching, read the circular division $n$ on the reference line. If it is a small number just **after** 0 (the gauge reads a little more than zero) → positive error ($+\,n \times$ LC). If it is a number just **before** 0, like 97 of 100 (the gauge reads a little less than zero) → negative error ($-(N - n) \times$ LC $= -3$ LC).
- In the usual textbook picture (circular numbers increasing upward), positive means the circular zero is **below** the line and negative means **above**. If the scale is numbered the other way, this flips (the NCERT lab manual asks about exactly this). So go by the reading, not by "above" or "below".

:::trap
For a negative zero error, do **not** write $-n \times$ LC. If the 7th of 10 vernier marks lines up (LC 0.1 mm), the error is $-(10 - 7) \times 0.1 = -0.3$ mm, not $-0.7$ mm. (NCERT's lab-manual example uses the 5th of 10 marks, where both ways give $-5$ LC, so it doesn't show the difference.)
:::

:::trap
**Pitch is not the least count.** Pitch = distance moved in one full turn. LC = pitch ÷ number of circular divisions. A screw gauge with pitch 0.5 mm and 50 divisions has LC 0.01 mm.
:::

- A reading is written to the **least count**: with LC 0.01 cm, write 2.40 cm, not 2.4 cm. The last digit shows the precision.
- **Backlash error** (screw gauge, travelling microscope): the screw turns a little before the spindle moves when you reverse direction. Always turn in **one direction** while taking a set of readings.

:::remember
Least count error is the smallest error an instrument can have. A smaller LC means a more **precise** instrument, not automatically a more **accurate** result (zero error and other systematic errors still matter).
:::

## Errors in results

- Relative errors **add**, for products and quotients alike. A squared quantity counts **twice**.
- Small quantities have the biggest relative errors, and a squared quantity counts twice. So in $Y = \dfrac{MgL}{\pi r^2 l}$ the radius $r$ and the extension $l$ matter most; in Stokes' law it is $r$.
- For a pendulum, $\dfrac{\Delta g}{g} = \dfrac{\Delta L}{L} + 2\dfrac{\Delta T}{T}$. Timing 20 oscillations instead of 1 makes $\Delta T/T$ twenty times smaller.

:::tip
In the metre bridge, the error in $X$ is smallest when the balance point is near the **middle** (50 cm). That is why $R$ is chosen to put the null point in the middle part of the wire.
:::

## Experiment by experiment

**E3 Pendulum.** Use a small amplitude. $A^2$ against $t$ is a falling **curve**, not a straight line. Effective length includes the radius of the bob.

**E4 Metre scale.** Balance the empty scale first. If the knife edge is not at the scale's centre of gravity, the scale's own weight also gives a moment and $m d_1 = M d_2$ is no longer enough.

**E5 Searle.** Stay within the elastic limit. Wait a little after each change of load. Remove kinks from the wire. Load and unload readings are averaged.

**E6 Capillary.** The tube must be **clean** and **vertical**. Grease raises the contact angle and lowers the rise. Hot water rises less (surface tension falls with temperature). Detergent lowers the rise.

:::trap
In capillary rise, use the **radius** of the bore, not the diameter. And $h$ is measured from the water surface **outside** the tube, not from the bottom of the tube.
:::

**E7 Viscosity.** Wet the ball with the liquid first; drop it gently along the **axis** of the jar, far from the walls; avoid air bubbles. The viscosity of a liquid **falls** as temperature rises, so keep the temperature steady.

**E8 Resonance tube.** Strike the fork on a **rubber pad**, never on a hard surface. Don't let it touch the tube. Using $l_2 - l_1$ removes the end correction. Expect $l_2 \approx 3l_1 + 2e$, a little more than $3l_1$.

:::trap
At the first resonance the air column is **not** $\lambda/4$; it is $\lambda/4 - e$. Use $v = 4\nu l_1$ only if the end correction is ignored, and it gives a value that is too **low**.
:::

**E9 Method of mixtures.** Move the hot solid **quickly** and without splashing. Stir well, use a lid, and note the highest steady temperature. Heat lost to the surroundings usually makes the specific heat of the solid come out **too small**.

**E10 Metre bridge.** Interchange $X$ and $R$ and average: this removes the **end error** (extra resistance at the ends of the wire). Press the jockey gently; don't slide it (that scrapes the wire). Pass current only while taking a reading, so the wire doesn't heat up.

**E11 Ohm's law.** Ammeter in **series**, voltmeter in **parallel**, + terminals towards the + of the cell. Keep the current small so the wire stays at constant temperature.

:::trap
Read the axes before using a slope. Slope of $V$ against $I$ is $R$. Slope of $I$ against $V$ is $1/R$. The steeper $I$–$V$ line belongs to the **smaller** resistance.
:::

**E12 Galvanometer.** Take out a **high** resistance from $R$ before closing $K_1$, or the galvanometer may be damaged. $G \approx S$ only when $R \gg S$; otherwise use $G = RS/(R - S)$. A smaller figure of merit means a **more sensitive** galvanometer.

**E13 Parallax.** Remove parallax **tip to tip**. Keep the needles at the same height as the centre of the mirror or lens. On moving the eye sideways, the needle farther from you appears to move **with** your eye.

**E14 Prism.** One value of $\delta$ (above $\delta_m$) comes from **two** angles of incidence, $i$ and $e$ (light can retrace its path). Only at $\delta_m$ are they equal.

**E15 Travelling microscope.** Move the microscope in one direction only (backlash). Remove parallax between the cross-wire and the image before each reading.

:::trap
Glass slab: $n = \dfrac{\text{real}}{\text{apparent}} = \dfrac{R_3 - R_1}{R_3 - R_2}$. Students often use the **shift** $R_2 - R_1$ as the apparent depth. Shift = real − apparent.
:::

**E16 Diode.** Forward current in **mA**, reverse current in **μA**: different scales on the same graph. Don't let the forward current exceed the diode's rating.

**E17 Zener.** Always use a **series resistance**. A Zener is used in **reverse** bias; forward biased it acts like an ordinary diode.

:::tip
**E18 quick sort:** both ways same → resistor. One way only → diode, and if it glows → LED. Kick then nothing → capacitor. The **longer leg** of an LED is the anode (+).
:::
