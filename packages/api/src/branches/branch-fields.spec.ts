import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminBranchesService } from '../admin/admin-branches.service';
import { Branch } from '../entities/branch.entity';
import { QrCode } from '../entities/qr-code.entity';

describe('Branch Fields Validation', () => {
  let service: AdminBranchesService;
  let branchRepo: any;

  beforeEach(async () => {
    branchRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((obj) => obj),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminBranchesService,
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(QrCode), useValue: { find: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get<AdminBranchesService>(AdminBranchesService);
  });

  describe('URL validation', () => {
    it('should accept valid https URLs', async () => {
      const branch = { id: '1', google_maps_url: null, google_review_url: null } as any;
      branchRepo.findOne.mockResolvedValue(branch);
      branchRepo.save.mockResolvedValue({ ...branch, google_maps_url: 'https://maps.google.com' });

      const result = await service.update('1', { google_maps_url: 'https://maps.google.com' });
      expect(result.google_maps_url).toBe('https://maps.google.com');
    });

    it('should reject http URLs', async () => {
      const branch = { id: '1' } as any;
      branchRepo.findOne.mockResolvedValue(branch);

      await expect(service.update('1', { google_maps_url: 'http://maps.google.com' })).rejects.toThrow(BadRequestException);
    });

    it('should accept null URL', async () => {
      const branch = { id: '1', google_maps_url: 'https://old.url' } as any;
      branchRepo.findOne.mockResolvedValue(branch);
      branchRepo.save.mockResolvedValue({ ...branch, google_maps_url: null });

      const result = await service.update('1', { google_maps_url: null });
      expect(result.google_maps_url).toBeNull();
    });
  });

  describe('WhatsApp number validation', () => {
    it('should accept valid 7-15 digit numbers', async () => {
      const branch = { id: '1', whatsapp_number: null } as any;
      branchRepo.findOne.mockResolvedValue(branch);
      branchRepo.save.mockResolvedValue({ ...branch, whatsapp_number: '971234567890' });

      const result = await service.update('1', { whatsapp_number: '+971234567890' });
      expect(result.whatsapp_number).toBe('971234567890');
    });

    it('should reject numbers with less than 7 digits', async () => {
      const branch = { id: '1' } as any;
      branchRepo.findOne.mockResolvedValue(branch);

      await expect(service.update('1', { whatsapp_number: '123456' })).rejects.toThrow(BadRequestException);
    });

    it('should accept null WhatsApp number', async () => {
      const branch = { id: '1', whatsapp_number: '971234567890' } as any;
      branchRepo.findOne.mockResolvedValue(branch);
      branchRepo.save.mockResolvedValue({ ...branch, whatsapp_number: null });

      const result = await service.update('1', { whatsapp_number: null });
      expect(result.whatsapp_number).toBeNull();
    });
  });
});
