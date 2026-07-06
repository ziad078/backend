import { Injectable } from '@nestjs/common'
import { CreateSessionDto } from './dto/create-session.dto'
import { InjectRepository } from '@nestjs/typeorm'
import { MoreThan, Repository } from 'typeorm'
import { Session } from './entities/session.entity'
import bcrypt from 'bcrypt'
@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private repo: Repository<Session>,
  ) {}
  async create(createSessionDto: CreateSessionDto) {
    const hash = await bcrypt.hash(createSessionDto.refreshToken, 10)

    const session = this.repo.create({
      userId: createSessionDto.userId,
      refreshTokenHash: hash,
      device: createSessionDto.device,
      ip: createSessionDto.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    return this.repo.save(session)
  }
  findAll() {
    return `This action returns all session`
  }

  async findOne(id: string) {
    return this.repo.findOneBy({ id })
  }
  async findValidSession(userId: string) {
    return this.repo.findOne({
      where: { userId, expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    })
  }

  async findValidSessions(userId: string) {
    return this.repo.find({
      where: { userId, expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    })
  }

  async deleteSession(sessionId: string) {
    await this.repo.delete(sessionId)
  }

  async deleteAllUserSessions(userId: string) {
    await this.repo.delete({ userId })
  }
}
