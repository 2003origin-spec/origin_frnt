---
title: "Electricity (Class 10): Short Notes"
type: short_notes
chapter: c10.physics.electricity
order: 2
---

## 1. Electric current and circuit

- **Electric current** is the rate of flow of electric charge: $I = Q/t$. Its SI unit is the **ampere** (A).
- In metal wires, the charges that move are **electrons**.
- **Direction of current:** by convention, current flows from the **positive** terminal of the cell to the **negative** terminal, through the circuit. This is **opposite** to the flow of electrons. (When electricity was first studied, electrons were not known, so current was taken as a flow of positive charge.)
- **Electric circuit:** a continuous and closed path for the current. If it is broken anywhere (switch off), the current stops.
- **Ammeter** measures current. It is always joined **in series**.

## 2. Potential difference

- Charges do not flow in a wire on their own, just as water does not flow in a level pipe. They flow only when there is a **potential difference** ("electric pressure") between the ends.
- A **cell** or **battery** makes this potential difference by the chemical action inside it. It uses up its stored chemical energy to keep the current going.
- **Potential difference** between two points = work done to move a unit charge from one point to the other: $V = W/Q$.
- **1 volt:** 1 joule of work is done to move 1 coulomb of charge between the two points.
- **Voltmeter** measures potential difference. It is always joined **in parallel** across the two points.

## 3. Circuit symbols

Know how to draw these (NCERT Table 11.1):

| Component | How it is drawn |
| --- | --- |
| Cell | A long thin line (+) and a short thick line (−) |
| Battery | Two or more cells joined in a row |
| Plug key / switch | Open: ( ) ; closed: (•) |
| Resistor | A zig-zag line |
| Rheostat | A zig-zag with an arrow across it or a sliding arrow on top |
| Ammeter, voltmeter | A circle with A or V, + and − marked |

Also: a wire joint (a dot where wires meet), wires crossing without joining, and an electric bulb.

## 4. Ohm's law

:::remember
**Ohm's law:** the potential difference $V$ across the ends of a metallic wire is directly proportional to the current $I$ through it, **provided its temperature remains the same**. So $V = IR$.
:::

- The **V–I graph** (NCERT Fig. 11.3: $I$ along the x-axis, $V$ along the y-axis) is a **straight line through the origin**. Its slope $V/I$ is the resistance $R$.
- **Resistance** is the property of a conductor to resist the flow of charges. SI unit: **ohm** ($\Omega$). $1\ \Omega$ = 1 V/1 A.
- The electrons are not fully free. The attraction of the atoms holds them back, and this causes resistance.
- $I = V/R$: for the same voltage, doubling $R$ halves the current.
- A **rheostat** (variable resistance) changes the current in a circuit without changing the voltage source.
- For pieces of the **same size**: a **good conductor** has low resistance, a **poor conductor** has higher resistance, and an **insulator** has even higher. A **resistor** is a conductor with some appreciable resistance.

## 5. What resistance depends on

For a uniform metal wire, $R = \rho\, l/A$. Resistance depends on:
1. **Length** $l$: $R \propto l$. Double the length, double the resistance (current halves).
2. **Area of cross-section** $A$: $R \propto 1/A$. A thicker wire has less resistance.
3. **Material:** through the resistivity $\rho$.

Both resistance and resistivity change with **temperature**.

- **Resistivity** $\rho$ is a property of the material. SI unit: $\Omega$ m.
- Metals and alloys: about $10^{-8}$ to $10^{-6}\ \Omega$ m (good conductors).
- Insulators (rubber, glass): about $10^{12}$ to $10^{17}\ \Omega$ m.
- From NCERT Table 11.2 (at 20°C): **silver** has the lowest resistivity (best conductor), then copper, then aluminium. Nichrome (an alloy) is very high. You need not memorise the values.

| Use | Material | Why |
| --- | --- | --- |
| Heating coils (iron, toaster) | Alloys, e.g. nichrome | High resistivity; do not oxidise (burn) readily when hot |
| Bulb filament | Tungsten | Very high melting point (3380°C) |
| Transmission lines | Copper, aluminium | Very low resistivity |

## 6. Series and parallel

| | Series | Parallel |
| --- | --- | --- |
| Current | Same in every resistor | Divides; branch currents add |
| Potential difference | Divides; adds up to $V$ | Same across each |
| Total resistance | Sum; more than the largest | Less than the smallest |
| If one part fails | Whole circuit stops | Others keep working |

Formulas: $R_s = R_1 + R_2 + R_3$ and $1/R_p = 1/R_1 + 1/R_2 + 1/R_3$.

**Why homes use parallel, not series:**
- In series, the current is the same everywhere. But a bulb and a heater need very different currents, so they cannot both work properly in series.
- In series, if one device fails, the circuit breaks and none works (like old "fairy lights").
- In parallel, each device gets the full voltage, takes the current it needs, and can be switched on or off on its own.

:::example{title="Mixed circuit"}
$10\ \Omega$ and $40\ \Omega$ in parallel give $R' = \dfrac{10 \times 40}{50} = 8\ \Omega$. Put this in series with $10\ \Omega$: total $18\ \Omega$. On a 9 V battery, $I = 9/18 = 0.5$ A.
:::

## 7. Heating effect of current

- When current flows, the source keeps supplying energy. Part of it may do useful work (a fan turns), and the rest becomes **heat**.
- In a **purely resistive** circuit (only resistors), **all** of it becomes heat. This is the **heating effect** of electric current.
- **Joule's law of heating:** $H = I^2Rt$. Heat is proportional to (i) the **square** of the current, (ii) the resistance, (iii) the time.

**Uses:**
- **Heating devices:** electric iron, toaster, oven, kettle, heater.
- **Electric bulb:** the tungsten filament gets very hot and gives out light. Most of the power still becomes heat; only a small part is light. The bulb is filled with chemically inactive **nitrogen and argon** to make the filament last longer.
- **Fuse:** a piece of wire of a metal or alloy with a suitable melting point (e.g. aluminium, copper, iron, lead). It is joined **in series** with the device. Too much current heats it, it **melts**, and the circuit breaks. Home fuses are rated 1 A, 2 A, 3 A, 5 A, 10 A, etc.

Heating is not always wanted: it wastes electrical energy and can change the properties of circuit parts.

## 8. Electric power and energy

- **Electric power** is the rate at which electrical energy is used: $P = VI = I^2R = V^2/R$.
- SI unit: **watt** (W). 1 W is the power used when 1 A flows at a potential difference of 1 V. So 1 W = 1 V A.
- The watt is small, so we often use the **kilowatt** (1 kW = 1000 W).
- **Energy** = power × time. The commercial unit is the **kilowatt hour** (kW h), called "**1 unit**" on the electricity bill.
- 1 kW h = $3.6 \times 10^6$ J.

:::remember
Electrons are **not used up** in a circuit. We pay the electricity company for the **energy** used to move the electrons through our devices.
:::
