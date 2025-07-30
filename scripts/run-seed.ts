#!/usr/bin/env tsx

import { seedMunsonFamily } from './seed-munson-family';

console.log('🌱 Running Munson Family Seed Script...');
console.log('📋 This will create realistic test data for:');
console.log('   - Nic Munson (nic@test.com) - Primary caregiver');
console.log('   - Michael McMillan (michael@test.com) - Partner');  
console.log('   - Jay Munson (jay@test.com) - Brother');
console.log('   - Sue Munson (75 years old) - Patient with cognitive decline');
console.log('');

seedMunsonFamily();