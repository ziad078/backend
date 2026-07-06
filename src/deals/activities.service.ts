import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CreateActivityDto } from './dto/create-activity.dto'
import { UpdateActivityDto } from './dto/update-activity.dto'
import { Activity } from './entities/activity.entity'
import { Deal } from './entities/deal.entity'

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly activitiesRepo: Repository<Activity>,
    @InjectRepository(Deal)
    private readonly dealsRepo: Repository<Deal>,
  ) {}

  async create(dto: CreateActivityDto): Promise<Activity> {
    const activity = this.activitiesRepo.create({
      name: dto.name.trim(),
    })
    return this.activitiesRepo.save(activity)
  }

  findAll(): Promise<Activity[]> {
    return this.activitiesRepo.find({
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string): Promise<Activity> {
    const activity = await this.activitiesRepo.findOne({ where: { id } })
    if (!activity) {
      throw new NotFoundException('Activity not found')
    }
    return activity
  }

  findAllWithDeals(): Promise<Activity[]> {
    return this.activitiesRepo.find({
      relations: ['deals', 'deals.organization', 'deals.creator'],
      order: { createdAt: 'DESC', deals: { createdAt: 'DESC' } },
    })
  }

  async findOneWithDeals(id: string): Promise<Activity> {
    const activity = await this.activitiesRepo.findOne({
      where: { id },
      relations: ['deals', 'deals.organization', 'deals.creator'],
      order: { deals: { createdAt: 'DESC' } },
    })
    if (!activity) {
      throw new NotFoundException('Activity not found')
    }
    return activity
  }

  async update(id: string, dto: UpdateActivityDto): Promise<Activity> {
    const activity = await this.findOne(id)
    if (dto.name !== undefined) {
      activity.name = dto.name.trim()
    }
    return this.activitiesRepo.save(activity)
  }

  async remove(id: string): Promise<{ message: string; activityId: string }> {
    const activity = await this.findOne(id)

    const hasDeals = await this.dealsRepo.exists({
      where: { activity: { id: activity.id } },
    })
    if (hasDeals) {
      throw new BadRequestException('Cannot delete activity because it has related deals')
    }

    await this.activitiesRepo.remove(activity)
    return { message: 'Activity deleted successfully', activityId: id }
  }
}
