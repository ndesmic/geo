---
title: Struct Packing
description: How struct packing works
---

## Alignment

Each element, either a prop or stuct must be aligned to a certain byte count.  This means if it would start on a byte index such that `index % alignment != 0` then you must pad to the nearest byte where `index % alignment == 0`.

## Structs

- Each element is placed based on its normal alignment.
- The full struct's alignment is the maximum alignment of it's props
- The full struct must be padded until it reaches an aligned byte for the struct

## Arrays

- Arrays must always align to 16 (which is the current maximum alignment)
- Alignment of elements in the array is the maximum alignment of struct
- The full array must be padded to a multiple of 16.

## Matrices

- Matrices are packed col major.  If your representation is row major (which is probably more typical in JS), then you need to transpose it.

## Why does alignment exist

- It's mostly an optimization thing for the hardware as it reads in chunks of data.