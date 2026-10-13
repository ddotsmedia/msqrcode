import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MenuImportService } from './menu-import.service';
import { Category } from '../entities/category.entity';
import { Product } from '../entities/product.entity';
import { Branch } from '../entities/branch.entity';

describe('MenuImportService', () => {
  let service: MenuImportService;
  let categoryRepo: any;
  let productRepo: any;
  let branchRepo: any;

  beforeEach(async () => {
    categoryRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((obj) => obj),
    };
    productRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      create: jest.fn((obj) => obj),
    };
    branchRepo = {
      find: jest.fn(() => Promise.resolve([])),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuImportService,
        { provide: getRepositoryToken(Category), useValue: categoryRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
      ],
    }).compile();

    service = module.get<MenuImportService>(MenuImportService);
  });

  it('should handle a valid row', async () => {
    const csv = Buffer.from('category,name,description,price_aed,dietary_tags,display_order,branch_codes\nDrinks,Coffee,Hot coffee,15,vegan,1,ALL');
    categoryRepo.findOne.mockResolvedValue(null);
    categoryRepo.save.mockResolvedValue({ id: '1', name: 'Drinks' });
    productRepo.findOne.mockResolvedValue(null);
    productRepo.save.mockResolvedValue({ id: '1', name: 'Coffee' });
    productRepo.find.mockResolvedValue([]);

    const result = await service.import(csv, 'test.csv', false);
    expect(result.created).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('should handle a bad price', async () => {
    const csv = Buffer.from('category,name,description,price_aed,dietary_tags,display_order,branch_codes\nDrinks,Coffee,Hot coffee,abc,vegan,1,ALL');
    const result = await service.import(csv, 'test.csv', true);
    expect(result.errors[0].message).toContain('Price must be a valid number');
  });

  it('should handle a new category', async () => {
    const csv = Buffer.from('category,name,description,price_aed,dietary_tags,display_order,branch_codes\nNewCategory,Coffee,Hot coffee,15,vegan,1,ALL');
    categoryRepo.findOne.mockResolvedValue(null);
    categoryRepo.save.mockResolvedValue({ id: '1', name: 'NewCategory' });
    productRepo.findOne.mockResolvedValue(null);
    productRepo.save.mockResolvedValue({ id: '1', name: 'Coffee' });
    productRepo.find.mockResolvedValue([]);

    const result = await service.import(csv, 'test.csv', false);
    expect(result.created).toBe(1);
    expect(categoryRepo.save).toHaveBeenCalled();
  });

  it('should not write when dry_run is true', async () => {
    const csv = Buffer.from('category,name,description,price_aed,dietary_tags,display_order,branch_codes\nDrinks,Coffee,Hot coffee,15,vegan,1,ALL');
    categoryRepo.findOne.mockResolvedValue({ id: '1', name: 'Drinks' });
    productRepo.findOne.mockResolvedValue(null);

    await service.import(csv, 'test.csv', true);
    expect(productRepo.save).not.toHaveBeenCalled();
  });
});
